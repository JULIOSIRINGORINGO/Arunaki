import { Injectable, Logger } from '@nestjs/common';
import { AiService, ChatMessage } from '../ai/ai.service.js';
import {
  ContextManager,
  StreamingContextScrubber,
} from '../ai/context-manager.js';
import { SelfEvaluationService } from '../ai/self-evaluation.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { DocumentReaderTool } from '../tools/services/document-reader.tool.js';
import { StorageService } from '../storage/storage.service.js';
import { FileService } from '../file/file.service.js';
import { SearchService } from '../search/search.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { BackgroundReviewService } from '../memory/background-review.service.js';
import { SmartRecallService } from '../memory/smart-recall.service.js';
import { SkillService } from '../skills/skill.service.js';
import { SelfHealingService } from '../ai/self-healing.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';

export type AgentState =
  | 'idle'
  | 'running'
  | 'steering'
  | 'aborting'
  | 'completed'
  | 'failed';

export interface WorkspaceRunState {
  workspaceId: string;
  state: AgentState;
  goal: string;
  startedAt: Date;
  round: number;
  abortController: AbortController;
}

export interface WorkspaceRunParams {
  workspaceId: string;
  userGoal: string;
  historyMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface WorkspaceStreamEvent {
  type:
    | 'thinking'
    | 'plan_created'
    | 'tool_start'
    | 'approval_required'
    | 'tool_done'
    | 'text_delta'
    | 'state_changed'
    | 'done'
    | 'error';
  data: any;
}

@Injectable()
export class WorkspaceRunnerService {
  private readonly logger = new Logger(WorkspaceRunnerService.name);
  private readonly scrubber = new StreamingContextScrubber();

  /** Active workspace runs — enables abort and state tracking */
  private readonly activeRuns = new Map<string, WorkspaceRunState>();

  /** Approval queue — holds approval promises per workspace */
  private readonly approvalQueue = new Map<
    string,
    {
      resolve: (approved: boolean) => void;
      toolName: string;
      args: Record<string, any>;
      timestamp: Date;
    }
  >();

  /** Request queue — holds pending requests when workspace is busy */
  private readonly requestQueue = new Map<
    string,
    Array<{
      resolve: () => void;
      reject: (error: Error) => void;
      goal: string;
      historyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      onEvent: (event: WorkspaceStreamEvent) => void;
      timestamp: Date;
    }>
  >();

  constructor(
    private readonly aiService: AiService,
    private readonly selfEvaluationService: SelfEvaluationService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly documentReaderTool: DocumentReaderTool,
    private readonly storageService: StorageService,
    private readonly fileService: FileService,
    private readonly searchService: SearchService,
    private readonly artifactService: ArtifactService,
    private readonly memoryService: MemoryService,
    private readonly backgroundReviewService: BackgroundReviewService,
    private readonly smartRecallService: SmartRecallService,
    private readonly skillService: SkillService,
    private readonly selfHealingService: SelfHealingService,
    private readonly prisma: PrismaService,
  ) {}

  /** Get current state of a workspace run */
  getRunState(workspaceId: string): WorkspaceRunState | undefined {
    return this.activeRuns.get(workspaceId);
  }

  /** Check if a workspace is currently running */
  isRunning(workspaceId: string): boolean {
    const state = this.activeRuns.get(workspaceId);
    return state?.state === 'running' || state?.state === 'steering';
  }

  /** Abort a running workspace analysis */
  abortRun(workspaceId: string, reason: string): boolean {
    const state = this.activeRuns.get(workspaceId);
    if (!state || (state.state !== 'running' && state.state !== 'steering')) {
      return false;
    }
    state.state = 'aborting';
    state.abortController.abort(reason);
    this.logger.log(`Workspace run abort requested: ${workspaceId} (${reason})`);
    return true;
  }

  /** Get all active run states (for dashboard/monitoring) */
  getAllActiveRuns(): WorkspaceRunState[] {
    return Array.from(this.activeRuns.values());
  }

  /**
   * Wait for approval on a specific tool call.
   * Returns a Promise that resolves when approval is received.
   * Used by the approval gate to pause execution without killing the loop.
   */
  private waitForApproval(
    workspaceId: string,
    toolName: string,
    args: Record<string, any>,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.approvalQueue.set(workspaceId, {
        resolve,
        toolName,
        args,
        timestamp: new Date(),
      });
      this.logger.log(`Approval queue: waiting for user approval (${toolName})`);
    });
  }

  /**
   * Resolve a pending approval request.
   * Called when user approves or rejects a tool call.
   */
  resolveApproval(workspaceId: string, approved: boolean): boolean {
    const pending = this.approvalQueue.get(workspaceId);
    if (!pending) return false;
    pending.resolve(approved);
    this.approvalQueue.delete(workspaceId);
    this.logger.log(`Approval resolved: ${approved ? 'approved' : 'rejected'} (${pending.toolName})`);
    return true;
  }

  /**
   * Enqueue a request when workspace is busy.
   * Returns a Promise that resolves when it's the request's turn.
   */
  private enqueueRequest(
    workspaceId: string,
    goal: string,
    historyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const queue = this.requestQueue.get(workspaceId) || [];
      queue.push({ resolve, reject, goal, historyMessages, onEvent, timestamp: new Date() });
      this.requestQueue.set(workspaceId, queue);
      this.logger.log(`Request queued for workspace ${workspaceId} (${queue.length} in queue)`);
    });
  }

  /**
   * Process next request in queue when current run finishes.
   */
  private async processNextInQueue(workspaceId: string): Promise<void> {
    const queue = this.requestQueue.get(workspaceId);
    if (!queue || queue.length === 0) return;

    const next = queue.shift()!;
    if (queue.length === 0) {
      this.requestQueue.delete(workspaceId);
    }

    this.logger.log(`Processing next queued request for workspace ${workspaceId}`);
    next.resolve(); // Unblocks the enqueued caller

    // Start the run
    try {
      await this.runWorkspaceAgentStream(
        {
          workspaceId,
          userGoal: next.goal,
          historyMessages: next.historyMessages,
        },
        next.onEvent,
      );
    } catch (error) {
      this.logger.error(`Queued request failed: ${error.message}`);
    }
  }

  private setState(
    runState: WorkspaceRunState,
    newState: AgentState,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): void {
    const oldState = runState.state;
    runState.state = newState;
    this.logger.debug(
      `Agent state: ${oldState} → ${newState} (workspace: ${runState.workspaceId})`,
    );
    onEvent({
      type: 'state_changed',
      data: {
        workspaceId: runState.workspaceId,
        from: oldState,
        to: newState,
        round: runState.round,
      },
    });
  }

  async buildWorkspaceContext(workspaceId: string): Promise<string> {
    try {
      const files = await this.fileService.findByWorkspaceId(workspaceId);
      const fileList =
        files.length > 0
          ? files
              .map(
                (f) =>
                  `- ${f.name} (Tipe: ${f.type || 'file'}, Ukuran: ${Math.round(f.size / 1024)} KB)`,
              )
              .join('\n')
          : 'Belum ada file di workspace ini.';

      // Auto-read top 5 files to give AI actual content
      const previews: string[] = [];
      const maxPreviews = Math.min(files.length, 5);
      for (let i = 0; i < maxPreviews; i++) {
        const f = files[i];
        try {
          const result = await this.documentReaderTool.readDocument(f.path);
          if (result.status === 'success' && result.data?.text) {
            const truncated = (result.data.text as string).substring(0, 2000);
            previews.push(`--- ${f.name} ---\n${truncated}${(result.data.text as string).length > 2000 ? '\n...[truncated]' : ''}`);
          }
        } catch {
          // skip unreadable files
        }
      }

      // Get workspace business type for domain-aware skills
      let businessType = 'generic';
      let rootPath: string | null = null;
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { businessType: true, rootPath: true },
        });
        if (workspace?.businessType) {
          businessType = workspace.businessType;
        }
        if (workspace?.rootPath) {
          rootPath = workspace.rootPath;
        }
      } catch {
        // fallback to generic
      }

      // Auto-inject relevant skills
      const skillsContext = await this.skillService.getSkillsContext(
        businessType,
        workspaceId,
      );

      // Frozen snapshot: inject relevant memories at session start
      const memoryContext = await this.memoryService.getMemoryContext(
        businessType,
        workspaceId,
      );

      let context = `=== WORKSPACE CONTEXT (ID: ${workspaceId}) ===\nRoot Path: ${rootPath || 'N/A'}\nDaftar Berkas Terdeteksi:\n${fileList}\n=== END WORKSPACE CONTEXT ===`;

      if (previews.length > 0) {
        context += `\n\n=== ISI FILE (Preview) ===\n${previews.join('\n\n')}\n=== END ISI FILE ===`;
      }

      if (skillsContext) {
        context += `\n\n=== RELEVANT SKILLS ===\n${skillsContext}\n=== END SKILLS ===`;
      }

      if (memoryContext) {
        context += `\n\n=== MEMORY SNAPSHOT ===\n${memoryContext}\n=== END MEMORY ===`;
      }

      return context;
    } catch {
      return '';
    }
  }

  async runWorkspaceAgentStream(
    params: WorkspaceRunParams,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ) {
    const {
      workspaceId,
      userGoal,
      historyMessages,
    } = params;

    // Guard: prevent duplicate runs on same workspace
    if (this.isRunning(workspaceId)) {
      onEvent({
        type: 'error',
        data: {
          message:
            'Workspace sedang dalam analisis. Tunggu selesai atau batalkan sebelum memulai baru.',
        },
      });
      return;
    }

    // Initialize state tracking
    const abortController = new AbortController();
    const runState: WorkspaceRunState = {
      workspaceId,
      state: 'idle',
      goal: userGoal,
      startedAt: new Date(),
      round: 0,
      abortController,
    };
    this.activeRuns.set(workspaceId, runState);

    try {
      this.setState(runState, 'running', onEvent);
      onEvent({
        type: 'thinking',
        data: 'Memindai dokumen workspace dan menyusun rencana otonom...',
      });

      const workspaceContext = await this.buildWorkspaceContext(workspaceId);

      // Smart recall: prefetch relevant memory and past conversations
      let recallContext = '';
      try {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { businessType: true },
        });
        recallContext = await this.smartRecallService.recall(
          userGoal,
          workspaceId,
          ws?.businessType || 'generic',
        );
        if (recallContext) {
          this.logger.log(
            `Smart recall: found ${recallContext.length} chars of relevant context`,
          );
        }
      } catch (err: any) {
        this.logger.debug(`Smart recall failed (non-critical): ${err.message}`);
      }

      const systemPrompt = this.aiService.getSystemPrompt(
        'workspace',
        workspaceContext,
      );
      const tools = this.toolRegistryService.getToolDefinitions();

      // Build system content with recall context injected
      let systemContent = systemPrompt;
      if (recallContext) {
        systemContent = `${systemPrompt}\n\n## Relevant Context (Auto-recalled)\n${recallContext}`;
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: systemContent },
        ...historyMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      // Generate autonomous reasoning plan via dedicated AI call
      if (abortController.signal.aborted) {
        this.setState(runState, 'aborting', onEvent);
        onEvent({
          type: 'error',
          data: { message: 'Analisis dibatalkan oleh pengguna.' },
        });
        return;
      }
      const planningMessages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'Kamu membuat rencana kerja singkat (maksimal 5 poin, satu kalimat per poin, dalam Bahasa Indonesia) untuk mencapai goal user di sebuah workspace. Balas HANYA dengan poin-poin rencana, tanpa penjelasan tambahan, satu poin per baris, diawali angka.',
        },
        {
          role: 'user',
          content: `Goal: ${userGoal}\n\nKonteks workspace:\n${workspaceContext}`,
        },
      ];

      let steps: string[] = [];
      try {
        const planResponse = await this.aiService.chat(planningMessages, []);
        if (planResponse.content) {
          steps = planResponse.content
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }
      } catch (e) {
        this.logger.warn(`AI plan generation failed: ${e.message}`);
      }

      onEvent({
        type: 'plan_created',
        data: {
          goal: userGoal,
          steps:
            steps.length > 0
              ? steps
              : ['Menyusun rencana berdasarkan goal Anda...'],
        },
      });

      let finalContent = '';
      const createdArtifactIds: string[] = [];
      const MAX_ROUNDS = 25;
      let reachedMaxRounds = true;

      for (let round = 0; round < MAX_ROUNDS; round++) {
        // Check abort before each round
        if (abortController.signal.aborted) {
          this.setState(runState, 'aborting', onEvent);
          onEvent({
            type: 'error',
            data: { message: 'Analisis dibatalkan oleh pengguna.' },
          });
          return;
        }
        runState.round = round + 1;

        const aiResponse = await this.aiService.chat(messages, tools);

        if (aiResponse.toolCalls.length === 0) {
          finalContent = this.scrubber.scrub(aiResponse.content);

          // Self-evaluation: verify output against goal
          try {
            const evaluation = await this.selfEvaluationService.evaluate(
              userGoal,
              finalContent,
              workspaceContext,
            );

            if (!evaluation.passed) {
              this.logger.log(
                `Self-evaluation: score ${evaluation.score}/10, issues: ${evaluation.issues.join('; ')}`,
              );

              // Auto-retry with feedback
              const retryResult =
                await this.selfEvaluationService.evaluateAndRetry(
                  userGoal,
                  finalContent,
                  async (feedback) => {
                    // Add feedback to messages and retry
                    messages.push({
                      role: 'user',
                      content: `Self-evaluation feedback: ${feedback}\n\nPlease fix the issues and provide a better output.`,
                    });
                    const retryResponse = await this.aiService.chat(
                      messages,
                      tools,
                    );
                    return this.scrubber.scrub(retryResponse.content);
                  },
                  workspaceContext,
                );

              finalContent = retryResult.output;
              this.logger.log(
                `Self-evaluation retry: final score ${retryResult.evaluation.score}/10`,
              );
            }
          } catch (err: any) {
            this.logger.warn(
              `Self-evaluation failed (non-critical): ${err.message}`,
            );
          }

          onEvent({ type: 'text_delta', data: finalContent });
          reachedMaxRounds = false;
          this.logger.log(
            'Workspace agent finished goal execution within round limit.',
          );
          break;
        }

        messages.push({
          role: 'assistant',
          content: aiResponse.content || null,
          tool_calls: aiResponse.toolCalls,
        });

        // Separate mutating vs read-only tools for parallel execution
        const mutatingTools = [
          'write_workspace_file',
          'update_workspace_file',
          'delete_workspace_file',
        ];

        const readOnlyCalls: Array<{
          toolCall: (typeof aiResponse.toolCalls)[0];
          args: Record<string, any>;
        }> = [];
        const mutatingCalls: Array<{
          toolCall: (typeof aiResponse.toolCalls)[0];
          args: Record<string, any>;
        }> = [];

        for (const toolCall of aiResponse.toolCalls) {
          const funcName = toolCall.function.name;
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            args = {};
          }

          if (mutatingTools.includes(funcName)) {
            mutatingCalls.push({ toolCall, args });
          } else {
            readOnlyCalls.push({ toolCall, args });
          }
        }

        // Execute read-only tools in parallel
        if (readOnlyCalls.length > 0) {
          onEvent({
            type: 'tool_start',
            data: {
              toolName: `parallel (${readOnlyCalls.map((c) => c.toolCall.function.name).join(', ')})`,
              args: {},
              timestamp: new Date().toISOString(),
            },
          });

          const parallelResults =
            await this.toolRegistryService.executeParallel(
              readOnlyCalls.map(({ toolCall, args }) => ({
                name: toolCall.function.name,
                args: { ...args, workspaceId },
              })),
            );

          for (let i = 0; i < readOnlyCalls.length; i++) {
            const { toolCall } = readOnlyCalls[i];
            const { result } = parallelResults[i];

            if (result.status === 'success' && result.metadata?.contentBase64) {
              const artifact = await this.artifactService.createFromAgent({
                workspaceId,
                type:
                  result.metadata.format === 'xlsx' ||
                  result.metadata.format === 'csv'
                    ? 'spreadsheet'
                    : 'document',
                name:
                  result.metadata.filename ||
                  `workspace-output-${Date.now()}.file`,
                mimeType:
                  result.metadata.mimeType || 'application/octet-stream',
                contentBase64: result.metadata.contentBase64,
                preview: result.preview,
                data: result.data,
                createdBy: `workspace-agent:${toolCall.function.name}`,
                tags: [
                  `workspace:${workspaceId}`,
                  `tool:${toolCall.function.name}`,
                ],
                lineage: [toolCall.function.name],
              });
              createdArtifactIds.push(artifact.id);
            }

            onEvent({
              type: 'tool_done',
              data: {
                toolName: toolCall.function.name,
                result,
                timestamp: new Date().toISOString(),
              },
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }
        }

        // Execute mutating tools sequentially (need approval gate)
        for (const { toolCall, args } of mutatingCalls) {
          const funcName = toolCall.function.name;

          this.logger.warn(
            `Approval Gate: Requesting consent for mutating tool "${funcName}".`,
          );

          this.setState(runState, 'steering', onEvent);
          onEvent({
            type: 'approval_required',
            data: {
              toolName: funcName,
              args,
              description: `Agent ingin melakukan aksi "${funcName}" (${args.filename || args.filePath || ''}) pada workspace. Mohon izinkan untuk melanjutkan.`,
            },
          });

          const approved = await this.waitForApproval(workspaceId, funcName, args);
          if (!approved) {
            onEvent({
              type: 'error',
              data: { message: `Aksi "${funcName}" ditolak oleh pengguna.` },
            });
            return;
          }

          onEvent({
            type: 'tool_start',
            data: {
              toolName: funcName,
              args,
              timestamp: new Date().toISOString(),
            },
          });

          let result: ToolResult;
          try {
            const enrichedArgs = { ...args, workspaceId };
            const healResult = await this.selfHealingService.executeWithHealing(
              funcName,
              enrichedArgs,
            );
            result = healResult.finalResult;
          } catch (e) {
            result = {
              status: 'error',
              data: {},
              preview: `Eksekusi tool gagal: ${e.message}`,
              metadata: {
                toolName: funcName,
                displayName: funcName,
                executionTime: 0,
              },
              error: { code: 'EXECUTION_FAILED', message: e.message },
            };
          }

          if (result.status === 'success' && result.metadata?.contentBase64) {
            const artifact = await this.artifactService.createFromAgent({
              workspaceId,
              type:
                result.metadata.format === 'xlsx' ||
                result.metadata.format === 'csv'
                  ? 'spreadsheet'
                  : 'document',
              name:
                result.metadata.filename ||
                `workspace-output-${Date.now()}.file`,
              mimeType: result.metadata.mimeType || 'application/octet-stream',
              contentBase64: result.metadata.contentBase64,
              preview: result.preview,
              data: result.data,
              createdBy: `workspace-agent:${funcName}`,
              tags: [`workspace:${workspaceId}`, `tool:${funcName}`],
              lineage: [funcName],
            });
            createdArtifactIds.push(artifact.id);
          }

          onEvent({
            type: 'tool_done',
            data: {
              toolName: funcName,
              result,
              timestamp: new Date().toISOString(),
            },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }

      if (reachedMaxRounds) {
        this.logger.warn(
          'Workspace agent reached max round limit without completion.',
        );
        if (!finalContent) {
          finalContent =
            'Agent mencapai batas maksimal langkah kerja. Hasil sejauh ini mungkin belum lengkap — silakan lanjutkan permintaan jika perlu.';
        }
      } else if (!finalContent) {
        finalContent = 'Pekerjaan otonom di Workspace telah selesai.';
      }

      const artifactRecords = await Promise.all(
        createdArtifactIds.map((aid) =>
          this.artifactService.findById(aid).catch(() => null),
        ),
      );

      const artifacts = artifactRecords.filter(Boolean).map((a) => {
        const meta = this.artifactService.parseMetadata(a!);
        return {
          id: a!.id,
          type: a!.type,
          filename: a!.name,
          mimeType: meta.mimeType || 'application/octet-stream',
          preview: a!.preview,
          status: 'draft',
          createdAt: a!.createdAt,
        };
      });

      onEvent({
        type: 'done',
        data: {
          content: finalContent,
          artifacts,
        },
      });

      this.setState(runState, 'completed', onEvent);

      // Persist analysis result to workspace (cached across sessions)
      try {
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            analysisResult: finalContent,
            analyzedAt: new Date(),
          },
        });
        this.logger.log(
          `Cached analysis result for workspace ${workspaceId} (${finalContent.length} chars)`,
        );
      } catch (e: any) {
        this.logger.warn(`Failed to cache analysis result: ${e.message}`);
      }

      // Auto-save memory after successful task completion
      try {
        // Fetch business type for domain-aware memory
        let saveDomain = 'generic';
        try {
          const ws = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { businessType: true },
          });
          if (ws?.businessType) saveDomain = ws.businessType;
        } catch {}

        await this.memoryService.recordWorkspaceHistory(
          workspaceId,
          `Goal: ${userGoal}\nHasil: ${finalContent.substring(0, 500)}`,
          saveDomain,
        );
        this.logger.log(
          `Auto-saved workspace history memory for workspace ${workspaceId}`,
        );

        // Background review — extract learnings from conversation
        await this.backgroundReviewService.reviewAndLearn(
          messages.map((m) => ({ role: m.role, content: m.content || '' })),
          workspaceId,
          saveDomain,
        );
      } catch (e) {
        this.logger.warn(`Failed to auto-save workspace history: ${e.message}`);
      }

      return finalContent;
    } catch (error) {
      this.setState(runState, 'failed', onEvent);
      this.logger.error(`Workspace stream execution failed: ${error.message}`);
      onEvent({ type: 'error', data: { message: error.message } });
      throw error;
    } finally {
      this.activeRuns.delete(workspaceId);
    }
  }
}
