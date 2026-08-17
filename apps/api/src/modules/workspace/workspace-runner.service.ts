import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiService, ChatMessage, ToolDefinition } from '../ai/ai.service.js';
import { repairToolCalls } from '../ai/tool-call-repair.js';
import {
  ContextManager,
  StreamingContextScrubber,
} from '../ai/context-manager.js';
import { ContextRegistry } from '../ai/context/context-registry.service.js';
import { getSystemDateTimeContext } from '../ai/context/date-time-context.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { StorageService } from '../storage/storage.service.js';
import { FileService } from '../file/file.service.js';
import { SearchService } from '../search/search.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { BackgroundReviewService } from '../memory/background-review.service.js';
import { SmartRecallService } from '../memory/smart-recall.service.js';
import { SkillService } from '../skills/skill.service.js';
import { SelfHealingService } from '../ai/self-healing.service.js';
import { PromptInjectionDetector } from '../ai/prompt-injection-detector.service.js';
import { CompactionService } from '../ai/compaction.service.js';
import { ToolResultFormatter } from '../tools/utils/tool-result-formatter.js';
import { TodoStoreService } from '../tools/services/todo-store.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';
import {
  createRunBudget,
  enterRunBudget,
} from '../ai/token-budget.service.js';
import { SessionAdmissionService } from '../chat/session-admission.service.js';
import * as path from 'path';

// After ≥1 successful mutation, a subsequent round that only re-reads files
// already touched is the model double-checking, not doing new work. For slow
// models (gpt-oss, qwen, ...) each verification round costs 30-160s — enough
// to blow the total timeout. Once the run drags past this threshold with no
import { WorkspacePromptBuilderService } from './services/workspace-prompt-builder.service.js';
import { TranscriptEngineService } from './services/transcript-engine.service.js';
import {
  extractMentionedFilenames,
  hasExplicitDeleteIntent,
  extractLooseArguments,
  extractInlineFunctionCalls,
} from './utils/tool-call-extractor.util.js';

export {
  extractMentionedFilenames,
  hasExplicitDeleteIntent,
  extractLooseArguments,
  extractInlineFunctionCalls,
};

// After ≥1 successful mutation, a subsequent round that only re-reads files
// already touched is the model double-checking, not doing new work. For slow
// models (gpt-oss, qwen, ...) each verification round costs 30-160s — enough
// to blow the total timeout. Once the run drags past this threshold with no
// new mutation, we conclude instead of letting it thrash.
const VERIFY_TAIL_MS = 90_000;

export interface WorkspaceStreamEvent {
  type:
    | 'thinking'
    | 'plan_created'
    | 'tool_start'
    | 'approval_required'
    | 'tool_done'
    | 'text_delta'
    | 'state_changed'
    | 'phase_changed'
    | 'steering'
    | 'done'
    | 'error';
  data: any;
}

@Injectable()
export class WorkspaceRunnerService {
  private readonly logger = new Logger(WorkspaceRunnerService.name);
  private readonly scrubber = new StreamingContextScrubber();

   /** Track modified files per workspace session */
  private readonly modifiedFiles = new Map<string, Array<{ filename: string; timestamp: Date }>>();

  /** Track read files per workspace session */
  private readonly readFiles = new Map<string, Array<{ filename: string; timestamp: Date }>>();

  private readonly mentionedFiles = new Map<string, Set<string>>();

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

  /** Steering queue — holds follow-up inputs for mid-run steering */
  private readonly steeringQueue = new Map<
    string,
    Array<{
      message: string;
      timestamp: Date;
    }>
  >();

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Inject(forwardRef(() => ToolRegistryService)) private readonly toolRegistryService: ToolRegistryService,
    @Inject(forwardRef(() => StorageService)) private readonly storageService: StorageService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
    @Inject(forwardRef(() => SearchService)) private readonly searchService: SearchService,
    @Inject(forwardRef(() => ArtifactService)) private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => MemoryService)) private readonly memoryService: MemoryService,
    @Inject(forwardRef(() => BackgroundReviewService)) private readonly backgroundReviewService: BackgroundReviewService,
    @Inject(forwardRef(() => SmartRecallService)) private readonly smartRecallService: SmartRecallService,
    @Inject(forwardRef(() => SkillService)) private readonly skillService: SkillService,
    @Inject(forwardRef(() => SelfHealingService)) private readonly selfHealingService: SelfHealingService,
    @Inject(forwardRef(() => PromptInjectionDetector)) private readonly promptInjectionDetector: PromptInjectionDetector,
    @Inject(forwardRef(() => CompactionService)) private readonly compactionService: CompactionService,
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ContextRegistry)) private readonly contextRegistry: ContextRegistry,
    @Inject(forwardRef(() => EventEmitter2)) private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TodoStoreService)) private readonly todoStore: TodoStoreService,
    @Inject(forwardRef(() => SessionAdmissionService)) private readonly sessionAdmissionService: SessionAdmissionService,
    @Inject(forwardRef(() => WorkspacePromptBuilderService)) private readonly promptBuilder: WorkspacePromptBuilderService,
    @Inject(forwardRef(() => TranscriptEngineService)) private readonly transcriptEngine: TranscriptEngineService,
  ) {}

  /** Delegate physical sync to WorkspacePromptBuilderService */
  async syncWorkspacePhysicalFiles(workspaceId: string): Promise<void> {
    return this.promptBuilder.syncWorkspacePhysicalFiles(workspaceId);
  }

  /** Delegate context building to WorkspacePromptBuilderService */
  async buildWorkspaceContext(workspaceId: string): Promise<string> {
    return this.promptBuilder.buildWorkspaceContext(workspaceId, this.modifiedFiles.get(workspaceId) || []);
  }

  /**
   * Get current state of a workspace run
   */
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
    timeoutMs = 120000,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.approvalQueue.get(workspaceId)?.toolName === toolName) {
          this.approvalQueue.delete(workspaceId);
          this.logger.warn(`Approval for ${toolName} timed out after ${timeoutMs}ms, rejecting`);
          resolve(false);
        }
      }, timeoutMs);
      this.approvalQueue.set(workspaceId, {
        resolve: (approved: boolean) => {
          clearTimeout(timer);
          resolve(approved);
        },
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
   * Run workspace agent stream as an async generator.
   * Modern streaming pattern — alternative to callback-based onEvent.
   */
  async *runWorkspaceAgentGenerator(
    params: WorkspaceRunParams,
  ): AsyncGenerator<WorkspaceStreamEvent> {
    const eventQueue: WorkspaceStreamEvent[] = [];
    let resolveEvent: ((value: WorkspaceStreamEvent | null) => void) | null = null;
    let done = false;

    const onEvent = (event: WorkspaceStreamEvent) => {
      if (resolveEvent) {
        const resolve = resolveEvent;
        resolveEvent = null;
        resolve(event);
      } else {
        eventQueue.push(event);
      }
    };

    const runPromise = this.runWorkspaceAgentStream(params, onEvent)
      .then(() => { done = true; if (resolveEvent) resolveEvent(null); })
      .catch((err) => {
        done = true;
        if (resolveEvent) resolveEvent(null);
        this.logger.error(`Workspace agent stream failed: ${err.message}`);
        onEvent({ type: 'error', data: { message: err.message } } as any);
      });

    while (!done) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else {
        const event = await new Promise<WorkspaceStreamEvent | null>((resolve) => {
          resolveEvent = resolve;
        });
        if (event) yield event;
      }
    }

    await runPromise;
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

  /**
   * Add steering/follow-up input for a running workspace.
   * The input will be injected into the agent loop on next outer iteration.
   */
  addSteeringInput(workspaceId: string, message: string): boolean {
    const state = this.activeRuns.get(workspaceId);
    if (!state || state.state !== 'running') {
      return false;
    }
    const queue = this.steeringQueue.get(workspaceId) || [];
    queue.push({ message, timestamp: new Date() });
    this.steeringQueue.set(workspaceId, queue);
    this.logger.log(`Steering input queued for workspace ${workspaceId}`);
    return true;
  }

  /** Map phase names to user-facing labels */
  private readonly PHASE_LABELS: Record<ExecutionPhase, string> = {
    scanning: 'Scanning workspace documents...',
    planning: 'Formulating execution plan...',
    reading: 'Reading file contents...',
    analyzing: 'Analyzing data...',
    generating: 'Generating output...',
    completed: 'Completed',
  };

  private setPhase(
    runState: WorkspaceRunState,
    phase: ExecutionPhase,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): void {
    const oldPhase = runState.currentPhase;
    runState.currentPhase = phase;
    this.logger.debug(`Phase: ${oldPhase} → ${phase} (workspace: ${runState.workspaceId})`);
    onEvent({
      type: 'phase_changed',
      data: {
        workspaceId: runState.workspaceId,
        from: oldPhase,
        to: phase,
        label: this.PHASE_LABELS[phase],
        round: runState.round,
      },
    });

    // Emit to EventEmitter for other listeners
    this.eventEmitter.emit('workspace.agent.phase_changed', {
      workspaceId: runState.workspaceId,
      from: oldPhase,
      to: phase,
      label: this.PHASE_LABELS[phase],
      round: runState.round,
      timestamp: new Date(),
    });
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

    // Emit to EventEmitter for other listeners
    this.eventEmitter.emit('workspace.agent.state_changed', {
      workspaceId: runState.workspaceId,
      from: oldState,
      to: newState,
      round: runState.round,
      timestamp: new Date(),
    });
  }

  async runWorkspaceAgentStream(
    params: WorkspaceRunParams,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ) {
    const {
      workspaceId,
      userGoal,
      historyMessages,
      modelId,
    } = params;

    let lease: any;
    try {
      lease = await this.sessionAdmissionService.acquireAdmission(workspaceId);
    } catch (error: any) {
      onEvent({
        type: 'error',
        data: {
          message:
            'Workspace is busy processing another request. Please wait.',
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
      currentPhase: 'scanning',
      abortController,
    };
    this.activeRuns.set(workspaceId, runState);

    try {
      this.setState(runState, 'running', onEvent);
      this.setPhase(runState, 'scanning', onEvent);
      this.modifiedFiles.delete(workspaceId);
      this.readFiles.delete(workspaceId);
      this.mentionedFiles.delete(workspaceId);
      this.todoStore.clear(workspaceId);

      // Emit agent started event
      this.eventEmitter.emit('workspace.agent.started', {
        workspaceId,
        goal: userGoal,
        timestamp: new Date(),
      });

      onEvent({
        type: 'thinking',
        data: 'Reading workspace context and processing request...',
      });

      const initial = await this.promptBuilder.buildInitialContext({
        workspaceId,
        userGoal,
        historyMessages,
        modifiedFiles: this.modifiedFiles.get(workspaceId) || [],
      });

      if (initial.injectionBlocked) {
        this.setState(runState, 'failed', onEvent);
        this.eventEmitter.emit('workspace.agent.failed', {
          workspaceId,
          goal: userGoal,
          reason: 'prompt_injection_blocked',
          timestamp: new Date(),
        });
        onEvent({
          type: 'error',
          data: { message: 'Input contains disallowed content. Please fix it and try again.' },
        });
        return;
      }

      const sessionId = params.sessionId || `session-${Date.now()}`;

      const {
        messages,
        tools,
        modelCtx,
        safeGoal,
        mentionedFileContents,
        workspaceRootPath,
      } = initial;
      this.mentionedFiles.set(workspaceId, new Set(mentionedFileContents.keys()));

      if (workspaceRootPath) {
        this.transcriptEngine.appendEvent(workspaceRootPath, sessionId, 'session_start', {
          userGoal,
          modelId,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      // Generate autonomous reasoning plan
      if (abortController.signal.aborted) {
        this.setState(runState, 'aborting', onEvent);

        // Emit agent aborted event
        this.eventEmitter.emit('workspace.agent.aborted', {
          workspaceId,
          goal: userGoal,
          timestamp: new Date(),
        });

        onEvent({
          type: 'error',
          data: { message: 'Analysis cancelled by user.' },
        });
        return;
      }
      // OpenClaw pattern: no regex intent routing, no separate planner call.
      // LLM loop below drives everything via native Function Calling —
      // simple tasks resolve in 1-2 rounds without extra LLM planning roundtrip.
      this.setPhase(runState, 'analyzing', onEvent);

        let finalContent = '';
        const createdArtifactIds: string[] = [];
        const MAX_ROUNDS = 25;
        let reachedMaxRounds = true;
        let executedToolCount = 0;
        let nudgeAttempts = 0;
        const runStartTime = Date.now();
        let mutationsApplied = 0;
        let noProgressRounds = 0;
        const touchedFiles = new Set<string>();
        const budget = createRunBudget();
        enterRunBudget(budget);

       // SINGLE-LOOP (opencode-style): call LLM → run tools → feed results
       // back → repeat until the model stops returning tool_calls. max_steps
       // is a hard safety bound; normal runs exit when toolCalls is empty.
       for (let round = 0; round < MAX_ROUNDS; round++) {
            // Check abort before each round
            if (abortController.signal.aborted) {
              this.setState(runState, 'aborting', onEvent);
              onEvent({
               type: 'error',
               data: { message: 'Analysis cancelled by user.' },
             });
             return;
           }
           runState.round = round + 1;

          // Inject current todo list (working memory) so LLM stays anchored
          // across long runs. Single [TODO] message updated in place per round.
          const todoText = this.todoStore.serialize(workspaceId);
          const todoIdx = messages.findIndex((m) => m.role === 'system' && m.content?.startsWith('=== TODO LIST ==='));
          if (todoText) {
            const todoMsg = { role: 'system' as const, content: todoText };
            if (todoIdx >= 0) messages[todoIdx] = todoMsg;
            else messages.push(todoMsg);
          } else if (todoIdx >= 0) {
            messages.splice(todoIdx, 1);
          }

          if (runState.round > 1) this.setPhase(runState, 'analyzing', onEvent);
          const roundMutationsStart = mutationsApplied;

          // If on the final safety round, disable tools and force a text-only summary (OpenCode pattern)
          const isFinalRound = round >= MAX_ROUNDS - 1;
          const toolsToPass = isFinalRound ? undefined : tools;
          if (isFinalRound) {
            messages.push({
              role: 'user',
              content: 'CRITICAL - MAXIMUM STEPS REACHED: Tools are now disabled. Please provide a clear final text summary of all work completed so far and any remaining recommendations.',
            });
          }

          const roundStart = Date.now();
          let aiResponse: { content: string; toolCalls: any[]; usage?: any } = { content: '', toolCalls: [] };
          let isStreamed = false;
          let streamedReasoning = '';

          try {
            let streamedText = '';
            const streamedToolCalls: any[] = [];

            for await (const chunk of this.aiService.chatStream(messages, toolsToPass, modelId ? { preferredProviderId: modelId } : undefined)) {
              if (chunk.type === 'content' && chunk.content) {
                streamedText += chunk.content;
                onEvent({ type: 'text_delta', data: chunk.content });
                isStreamed = true;
              } else if (chunk.type === 'reasoning' && chunk.content) {
                streamedReasoning += chunk.content;
                onEvent({ type: 'thinking', data: chunk.content });
              } else if (chunk.type === 'tool_call' && chunk.toolCall) {
                streamedToolCalls.push({
                  id: chunk.toolCall.id,
                  type: 'function',
                  function: {
                    name: chunk.toolCall.name,
                    arguments: chunk.toolCall.arguments,
                  },
                });
              }
            }

            aiResponse = {
              content: streamedText,
              toolCalls: streamedToolCalls,
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
          } catch (streamErr: any) {
            this.logger.warn(`chatStream failed or unsupported, falling back to chat: ${streamErr.message}`);
            aiResponse = await this.aiService.chat(messages, tools, modelId ? { preferredProviderId: modelId } : undefined);
          }

          // If stream produced 0 content, 0 tool calls, and 0 reasoning, attempt non-streaming fallback
          if ((aiResponse.content || '').trim().length === 0 && (aiResponse.toolCalls?.length ?? 0) === 0 && streamedReasoning.trim().length === 0) {
            this.logger.warn(`chatStream returned empty output, attempting non-streaming chat fallback...`);
            try {
              aiResponse = await this.aiService.chat(messages, toolsToPass, modelId ? { preferredProviderId: modelId } : undefined);
            } catch (chatErr: any) {
              this.logger.error(`Non-streaming chat fallback failed: ${chatErr.message}`);
            }
          }

          this.logger.log(
            `[round] ${runState.round} took ${Date.now() - roundStart}ms; toolCalls=${aiResponse.toolCalls?.length ?? 0} usage=${JSON.stringify(aiResponse.usage)}`,
          );

          // Initialize toolCalls if undefined (some providers return undefined instead of empty array)
          aiResponse.toolCalls = aiResponse.toolCalls || [];

          // Fallback parser for leaked raw tool syntax or reasoning tool calls (e.g., GPT-OSS-120B / DeepSeek v4)
          if (aiResponse.toolCalls.length === 0) {
            const rawTextToSearch = aiResponse.content || streamedReasoning;
            if (rawTextToSearch) {
              const repaired = repairToolCalls(rawTextToSearch);
              if (repaired.length > 0) {
                this.logger.log(`[WorkspaceRunner] Repaired ${repaired.length} tool call(s) from streamed text/reasoning`);
                aiResponse.toolCalls = repaired;
                aiResponse.content = (aiResponse.content || '')
                  .replace(/```(?:json|tool|function)?\s*\{[\s\S]*?\}\s*```/gi, '')
                  .replace(/<\s*function\/[a-zA-Z0-9_-]+\s*>[\s\S]*?<\/\s*function\s*>/gi, '')
                  .replace(/<\s*function:[a-zA-Z0-9_-]+\s*>[\s\S]*?<\/\s*function\s*>/gi, '')
                  .replace(/<\s*tool_call\s*>[\s\S]*?<\/\s*tool_call\s*>/gi, '')
                  .replace(/<\s*function_call\s*>[\s\S]*?<\/\s*function_call\s*>/gi, '')
                  .replace(/<\s*function(?:[^>]*)>[\s\S]*?<\/\s*function\s*>/gi, '')
                  .replace(/(?:Action|Tool|Function)\s*:\s*[a-zA-Z0-9_-]+\s*(?:Action Input|Arguments|Parameters|Input)\s*:\s*\{[\s\S]*?\}/gi, '')
                  .trim();
              } else if (rawTextToSearch.includes('<|tool_call>')) {
                const toolCallMatch = rawTextToSearch.match(/<\|tool_call>call:([a-zA-Z0-9_]+)(.*?)(?:<tool_call\|>|<\|tool_call\|>|$)/s);
                if (toolCallMatch) {
                  const funcName = toolCallMatch[1];
                  let rawArgs = toolCallMatch[2].trim();
                  rawArgs = rawArgs.replace(/<\|">/g, '"');
                  rawArgs = rawArgs.replace(/([{\[,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
                  aiResponse.toolCalls.push({
                    id: `call_fallback_${Date.now()}`,
                    type: 'function',
                    function: {
                      name: funcName,
                      arguments: rawArgs,
                    },
                  });
                  aiResponse.content = (aiResponse.content || '').replace(/<\|tool_call>.*?(?:<tool_call\|>|<\|tool_call\|>|$)/s, '').trim();
                }
              }
            }
          }

          // Token budget enforcement: accumulate usage across all rounds;
          // stop the run with a clear message when the budget is exhausted.
          budget.consume(aiResponse.usage?.totalTokens || 0);
          if (budget.exceeded) {
            this.logger.warn(
              `Token budget exceeded: ${budget.used}/${budget.limit} tokens after round ${runState.round}. Stopping the run.`,
            );
            finalContent = `Run stopped: the token budget limit (${budget.limit.toLocaleString('en-US')} tokens) was exceeded after ${budget.used.toLocaleString('en-US')} tokens. Please break the task into smaller parts or continue in a new session.`;
            onEvent({
              type: 'error',
              data: { message: finalContent, budget: { used: budget.used, limit: budget.limit } },
            });
            reachedMaxRounds = false;
            break;
          }

          if (aiResponse.toolCalls.length === 0) {
            const hasFileMutationIntent =
              /@[\w.-]+/i.test(userGoal) ||
              /\b(?:update|edit|ubah|rekap|hitung|tulis|buat|write|modify|replace|delete|hapus|patch)\b/i.test(userGoal);

            const isEarlyRoundWithoutAction = runState.round <= 2 && hasFileMutationIntent && executedToolCount === 0;

            if (isEarlyRoundWithoutAction && nudgeAttempts < 2) {
              nudgeAttempts++;
              this.logger.log(`[Self-Correction] Round ${runState.round} produced 0 tool calls for file mutation task. Injecting action nudge (attempt ${nudgeAttempts})...`);
              if (aiResponse.content) {
                messages.push({
                  role: 'assistant',
                  content: aiResponse.content,
                });
              }
              messages.push({
                role: 'user',
                content: '[System Action Required] You did not execute any tool to apply the requested modifications. Please output a valid tool call (e.g. edit or write) using proper JSON format to apply the file changes directly now.',
              });
              continue;
            }

            finalContent = this.scrubber.scrub(aiResponse.content);
            if (!isStreamed) {
              onEvent({ type: 'text_delta', data: finalContent });
            }
            onEvent({ type: 'done', data: { content: finalContent, artifacts: createdArtifactIds } });
            reachedMaxRounds = false;
            this.logger.log(
              'Workspace agent finished goal execution within round limit.',
            );
            break;
          }

          // plan_created only for multi-step tasks (round > 1 or >1 tool in a
          // single round). A single tool on round 1 = direct execution, no
          // plan event needed — the UI shows tool_start immediately.
          const isSingleStep =
            runState.round === 1 &&
            aiResponse.toolCalls.length === 1;
          if (!isSingleStep && runState.round === 1) {
            const planSteps = aiResponse.toolCalls.map((tc) => {
              let argSummary = '';
              try {
                const args = JSON.parse(tc.function.arguments || '{}');
                argSummary = args.filename || args.path || args.query || '';
              } catch {
                argSummary = '';
              }
              return `${tc.function.name}${argSummary ? ` → ${argSummary}` : ''}`;
            });
            onEvent({
              type: 'plan_created',
              data: {
                goal: safeGoal,
                steps: planSteps.length > 0 ? planSteps : ['Processing request...'],
              },
            });
          }

          if (aiResponse.toolCalls.length === 0 && aiResponse.content) {
            const inlineCalls = extractInlineFunctionCalls(aiResponse.content);
            if (inlineCalls.length > 0) {
              aiResponse.toolCalls.push(...inlineCalls);
              this.logger.log(
                `Extracted ${inlineCalls.length} inline function calls from model response`,
              );
            }
          }

          messages.push({
            role: 'assistant',
            content: aiResponse.content || null,
            tool_calls: aiResponse.toolCalls,
          });

          // Intercept ask_user: if the AI explicitly wants to ask the user, stop the execution loop immediately!
          const askUserToolCall = aiResponse.toolCalls.find(tc => tc.function.name === 'ask_user');
          if (askUserToolCall) {
            let message = 'Please provide additional information to process this request.';
            try { 
              const args = JSON.parse(askUserToolCall.function.arguments || '{}');
              if (args.message) message = args.message;
            } catch {}
            
            finalContent = message;
            onEvent({ type: 'text_delta', data: finalContent });
            reachedMaxRounds = false;
            break;
          }

          // Update phase based on tool types
          const hasReadTools = aiResponse.toolCalls.some((tc) =>
            ['search_workspace', 'read', 'list'].includes(tc.function.name),
          );
          const hasWriteTools = aiResponse.toolCalls.some((tc) =>
            ['write', 'generate_export', 'draft_communication'].includes(tc.function.name),
          );
          if (hasReadTools) this.setPhase(runState, 'reading', onEvent);
          if (hasWriteTools) this.setPhase(runState, 'generating', onEvent);

          // OpenClaw pattern: strict subset enforcement. Only tools declared in
          // body.tools are executable; a hallucinated call to an undeclared
          // (but registered) tool is rejected with corrective feedback instead
          // of being executed — otherwise weak models loop forever (e.g.
          // gpt-oss-120b calling `calculate`/`data_query` that were never sent).
          const declaredTools = new Set(
            tools.map((t) => t.function?.name || ''),
          );
          // Internal harness tools stay callable regardless of subset.
          declaredTools.add('ask_user');
          declaredTools.add('agent_spawn');
          declaredTools.add('todo_write');

          // Separate mutating vs read-only tools for parallel execution

          const readOnlyCalls: Array<{
            toolCall: (typeof aiResponse.toolCalls)[0];
            args: Record<string, any>;
          }> = [];
          const mutatingCalls: Array<{
            toolCall: (typeof aiResponse.toolCalls)[0];
            args: Record<string, any>;
          }> = [];
          let concludeRun = false;

          for (const toolCall of aiResponse.toolCalls) {
            const funcName = toolCall.function.name;
            let args: Record<string, any> = {};
            const rawArgsRaw = toolCall.function.arguments || '';
            try {
              const rawArgs = rawArgsRaw || '{}';
              try {
                args = JSON.parse(rawArgs);
              } catch {
                const cleaned = rawArgs
                  .replace(/[\u0000-\u001F]+/g, (match: string) => {
                    if (match === '\n') return '\\n';
                    if (match === '\r') return '\\r';
                    if (match === '\t') return '\\t';
                    return '';
                  });
                args = JSON.parse(cleaned);
              }
            } catch {
              args = extractLooseArguments(rawArgsRaw);
              if (Object.keys(args).length > 0) {
                this.logger.log(
                  `[tool-call] ${funcName} recovered arguments using loose extraction: ${JSON.stringify(Object.keys(args))}`,
                );
              } else {
                this.logger.warn(
                  `[tool-call] ${funcName} JSON.parse failed and loose extraction found 0 keys. Raw arguments: ${JSON.stringify(rawArgsRaw.slice(0, 300))}`,
                );
              }
            }
            if (Object.keys(args).length === 0 && rawArgsRaw.length > 0 && rawArgsRaw !== '{}') {
              args = extractLooseArguments(rawArgsRaw);
            }

            if (!declaredTools.has(funcName)) {
              this.logger.warn(
                `Rejected undeclared tool call "${funcName}" (not in active tool subset).`,
              );
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content:
                  `Error: tool "${funcName}" is not available for this task. ` +
                  `Available tools: [${[...declaredTools].join(', ')}]. ` +
                  'Use one of those tools.',
              });
              continue;
            }

            // Harness hardening: weak models (gpt-oss, qwen, ...) sometimes
            // emit a mutating tool call with zero arguments. Executing it just
            // burns a full round on a guaranteed error. Feed back a corrective
            // message immediately; if the run already applied changes and is
            // thrashing (empty re-edits after success), conclude instead.
            if (
              this.toolRegistryService.isMutating(funcName) &&
              Object.keys(args).length === 0
            ) {
              if (
                mutationsApplied > 0 &&
                noProgressRounds >= 2 &&
                Date.now() - runStartTime > VERIFY_TAIL_MS
              ) {
                finalContent = aiResponse.content?.trim()
                  ? aiResponse.content
                  : 'Autonomous workspace task completed.';
                reachedMaxRounds = false;
                concludeRun = true;
                break;
              }
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content:
                  `Error: tool "${funcName}" was called without any arguments. ` +
                  (funcName === 'edit'
                    ? 'edit requires "filePath" plus (patchText OR oldString+newString) to act. '
                    : `${funcName} requires its target fields (e.g. "filePath") to act. `) +
                  (mutationsApplied > 0
                    ? 'The requested changes appear to already be applied. If all changes are done, reply with your final summary text and do NOT call any more tools.'
                    : 'Reissue the tool call with the required fields.'),
              });
              continue;
            }

            // Circuit Breaker (OpenClaw pattern): failed tool results return
            // to the model verbatim; the model self-corrects on the next turn.
            // The round cap (MAX_ROUNDS) is the hard loop bound.

            if (this.toolRegistryService.isMutating(funcName)) {
              executedToolCount++;
              mutatingCalls.push({ toolCall, args });
            } else {
              readOnlyCalls.push({ toolCall, args });
            }
          }

          if (concludeRun) break;

          // Verification-tail cutoff (OpenClaw pattern): after ≥1 successful
          // mutation, a round that only re-reads files already touched — and
          // drags past the time budget — is the model double-checking its own
          // work, not making progress. Slow models burn 30-160s per such round;
          // conclude here instead of waiting for MAX_ROUNDS or the timeout.
          if (
            mutationsApplied > 0 &&
            noProgressRounds >= 2 &&
            mutatingCalls.length === 0 &&
            readOnlyCalls.length > 0 &&
            Date.now() - runStartTime > VERIFY_TAIL_MS
          ) {
            const allKnownTargets = readOnlyCalls.every(({ args: ra }) => {
              const base = path
                .basename(String(ra.filename || ra.path || ra.filePath || ''))
                .toLowerCase();
              return !base || touchedFiles.has(base);
            });
            if (allKnownTargets) {
              this.logger.log(
                `[Harness] Round ${runState.round} only re-reads already-touched files after ${mutationsApplied} successful mutation(s) — concluding run.`,
              );
              finalContent = aiResponse.content?.trim()
                ? aiResponse.content
                : 'Autonomous workspace task completed.';
              reachedMaxRounds = false;
              break;
            }
          }

          // Execute read-only tools in parallel (semantically safe: no writes)
          if (readOnlyCalls.length > 0) {
            onEvent({
              type: 'tool_start',
              data: {
                toolName: `parallel (${readOnlyCalls.map((c) => c.toolCall.function.name).join(', ')})`,
                args: {},
                timestamp: new Date().toISOString(),
              },
            });

            const healedResults = await Promise.all(
              readOnlyCalls.map(async ({ toolCall, args }) => {
                const enrichedArgs = { ...args, workspaceId };
                const result = await this.selfHealingService.executeWithIsolation(
                  toolCall.function.name,
                  enrichedArgs,
                  workspaceId,
                );
                return { toolCall, args, result };
              }),
            );

            // Emit in original tool_calls order so tool_call_id stays consistent
            for (const { toolCall, args, result } of healedResults) {
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

              // Track file reads
              if (['search_workspace', 'read', 'list'].includes(toolCall.function.name)) {
                const current = this.readFiles.get(workspaceId) || [];
                current.push({ filename: args.filename || args.path || 'unknown', timestamp: new Date() });
                this.readFiles.set(workspaceId, current.slice(-30));
                if (result.status === 'success') {
                  const rf = String(args.filename || args.path || args.filePath || '');
                  if (rf) touchedFiles.add(path.basename(rf).toLowerCase());
                }
              }

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: ToolResultFormatter.formatForLlm(toolCall.function.name, result),
              });
            }
          }

          // Execute mutating tools — full autonomous with built-in safety:
          for (const { toolCall, args } of mutatingCalls) {
            const funcName = toolCall.function.name;

            this.logger.log(`Auto-executing workspace tool: ${funcName} (${args.filename || args.keys || ''})`);

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
              const mentionedFiles = this.mentionedFiles.get(workspaceId) || new Set<string>();
              const rawTargetName = String(args.filename || args.filePath || '');
              const targetBasename = path.basename(rawTargetName).toLowerCase();
              const isMentioned = [...mentionedFiles].some(
                (name) => path.basename(name).toLowerCase() === targetBasename,
              );
              if (mentionedFiles.size > 0 && funcName === 'write' && !isMentioned) {
                throw new Error('A file referenced with @ must be the update target.');
              }
              if (isMentioned && ['delete', 'rename'].includes(funcName)) {
                throw new Error('Files referenced with @ cannot be deleted or renamed during an edit run.');
              }
              if (funcName === 'delete' && !hasExplicitDeleteIntent(safeGoal, rawTargetName)) {
                throw new Error('Deletion denied: the instruction must explicitly ask to delete and name the target file.');
              }
              if (typeof args.content === 'string' && /@[^\s@]+\.[A-Za-z0-9]{1,10}/.test(args.content)) {
                throw new Error('Content still contains raw @file references and cannot be saved.');
              }
              const enrichedArgs: Record<string, any> = { ...args, workspaceId, rootPath: workspaceRootPath };
              if (!enrichedArgs.filePath && !enrichedArgs.path && !enrichedArgs.filename && mentionedFiles.size === 1) {
                enrichedArgs.filePath = [...mentionedFiles][0];
                enrichedArgs.path = [...mentionedFiles][0];
              }

              // Capture pre-mutation snapshot for 1-Click Rollback / Transcript
              let preSnapshot: string | null = null;
              if (workspaceRootPath && rawTargetName) {
                preSnapshot = this.transcriptEngine.captureFileSnapshot(workspaceRootPath, rawTargetName);
                this.transcriptEngine.appendEvent(workspaceRootPath, sessionId, 'file_snapshot_pre', {
                  tool: funcName,
                  filePath: rawTargetName,
                  snapshotContent: preSnapshot,
                  fileExisted: preSnapshot !== null,
                  timestamp: new Date().toISOString(),
                }).catch(() => {});
              }

              result = await this.selfHealingService.executeWithIsolation(
                funcName,
                enrichedArgs,
                workspaceId,
              );

              // Capture post-mutation snapshot and tool result
              if (workspaceRootPath && rawTargetName) {
                const postSnapshot = this.transcriptEngine.captureFileSnapshot(workspaceRootPath, rawTargetName);
                this.transcriptEngine.appendEvent(workspaceRootPath, sessionId, 'tool_call_post', {
                  tool: funcName,
                  args,
                  status: result.status,
                  preview: result.preview,
                  timestamp: new Date().toISOString(),
                }).catch(() => {});
                if (result.status === 'success') {
                  this.transcriptEngine.appendEvent(workspaceRootPath, sessionId, 'file_snapshot_post', {
                    tool: funcName,
                    filePath: rawTargetName,
                    snapshotContent: postSnapshot,
                    timestamp: new Date().toISOString(),
                  }).catch(() => {});
                }
              }
            } catch (e) {
              result = {
                status: 'error',
                data: {},
                preview: `Tool execution failed: ${e.message}`,
                metadata: {
                  toolName: funcName,
                  displayName: funcName,
                  executionTime: 0,
                },
                error: { code: 'EXECUTION_FAILED', message: e.message },
              };
            }

            if (result.status === 'error') {
              this.logger.warn(`Tool "${funcName}" returned error: ${result.error?.message || result.preview}`);
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

            // Track modified files
            if (result.status === 'success') {
              mutationsApplied++;
              const filename = args.filename || args.path || args.filePath || 'unknown';
              const fname = String(filename);
              if (fname && fname !== 'unknown') {
                touchedFiles.add(path.basename(fname).toLowerCase());
              }
              const current = this.modifiedFiles.get(workspaceId) || [];
              current.push({ filename, timestamp: new Date() });
              this.modifiedFiles.set(workspaceId, current.slice(-30));
            }

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: ToolResultFormatter.formatForLlm(funcName, result),
            });
          }

          // Track no-progress rounds (consecutive rounds with zero successful mutation).
          if (mutationsApplied > roundMutationsStart) {
            noProgressRounds = 0;
          } else {
            noProgressRounds++;
          }

          // Smart Circuit Breaker: If mutations were successfully applied to the workspace,
          // and no further mutations happened for 2 rounds, conclude the run immediately!
          if (mutationsApplied > 0 && noProgressRounds >= 2) {
            this.logger.log(
              `[WorkspaceRunner] Concluding run: ${mutationsApplied} mutation(s) applied and verified across rounds.`,
            );
            finalContent = finalContent || 'File modifications have been applied and verified.';
            reachedMaxRounds = false;
            break;
          }

          // Compact history if the accumulated token budget is exceeded
          const compactResult = await this.compactionService.compactHistory(
            messages,
            modelCtx.contextWindow,
          );
          if (compactResult.wasCompacted) {
            messages.length = 0;
            messages.push(...compactResult.compactedMessages);
          }

          // opencode-style: keep looping while the model keeps returning tool_calls.
          const steeringInputs = this.steeringQueue.get(workspaceId) || [];
          if (steeringInputs.length > 0) {
            const steering = steeringInputs.shift()!;
            if (steeringInputs.length === 0) {
              this.steeringQueue.delete(workspaceId);
            }
            messages.push({
              role: 'user',
              content: steering.message,
            });
            this.logger.log(`Steering input injected for workspace ${workspaceId}: "${steering.message.substring(0, 100)}"`);
            onEvent({
              type: 'steering',
              data: { message: 'Follow-up received, continuing analysis...' },
            });
          }
        }

        if (reachedMaxRounds) {
          this.logger.warn(
            'Workspace agent reached max round limit without completion.',
          );
        }
        if (!finalContent) {
          if (reachedMaxRounds) {
            finalContent =
              'Agent reached maximum step limit. Results so far may be incomplete -- please continue your request if needed.';
          } else {
            finalContent = 'Autonomous workspace task completed.';
          }
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

        this.setPhase(runState, 'completed', onEvent);
        this.setState(runState, 'completed', onEvent);

        // Emit agent completed event
        this.eventEmitter.emit('workspace.agent.completed', {
          workspaceId,
          goal: userGoal,
          finalContent: finalContent.substring(0, 200),
          messages: messages.map((m) => ({ role: m.role, content: m.content || '' })),
          artifactsCount: artifacts.length,
          timestamp: new Date(),
        });

        // Fire-and-forget: Persist workspace cache, history memory & background review asynchronously
        const modified = this.modifiedFiles.get(workspaceId) || [];
        const memoryDetails = {
          goal: userGoal,
          result: finalContent.substring(0, 500),
          modifiedFiles: modified.map((f) => f.filename),
          totalRounds: runState.round,
          timestamp: new Date().toISOString(),
        };

        setImmediate(async () => {
          try {
            await this.prisma.workspace.update({
              where: { id: workspaceId },
              data: {
                analysisResult: finalContent,
                analyzedAt: new Date(),
              },
            }).catch((e) => this.logger.warn(`Failed to cache analysis result: ${e.message}`));

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
              `Goal: ${userGoal}\nResult: ${finalContent.substring(0, 500)}`,
              saveDomain,
            ).catch(() => {});

            await this.memoryService.remember({
              type: 'run_summary',
              key: `run_${workspaceId}_${Date.now()}`,
              content: JSON.stringify(memoryDetails),
              source: 'auto',
              importance: 6,
              domain: saveDomain,
              workspaceId,
            }).catch(() => {});

            await this.backgroundReviewService.reviewAndLearn(
              messages.map((m) => ({ role: m.role, content: m.content || '' })),
              workspaceId,
              saveDomain,
            ).catch(() => {});
          } catch (e: any) {
            this.logger.warn(`Background post-processing warning: ${e.message}`);
          }
        });

        return finalContent;
    } catch (error: any) {
      this.setState(runState, 'failed', onEvent);

      // Emit agent failed event
      this.eventEmitter.emit('workspace.agent.failed', {
        workspaceId,
        goal: userGoal,
        error: error?.message || 'Unknown error',
        timestamp: new Date(),
      });

      this.logger.error(`Workspace stream execution failed: ${error.message}`);
      const friendly = /rate limit|429|free-models-per-day/i.test(error.message)
        ? 'The AI server is rate-limited (HTTP 429). Try again in a few minutes or use a paid API key.'
        : error.message;
      onEvent({ type: 'error', data: { message: friendly, code: 'AI_PROVIDER_ERROR' } });
      throw error;
    } finally {
      this.activeRuns.delete(workspaceId);
      if (lease) {
        await lease.release().catch((e: any) => this.logger.warn(`Failed to release lease: ${e.message}`));
      }
    }
  }
}


export type AgentState =
  | 'idle'
  | 'running'
  | 'steering'
  | 'aborting'
  | 'completed'
  | 'failed';

export type ExecutionPhase =
  | 'scanning'
  | 'planning'
  | 'reading'
  | 'analyzing'
  | 'generating'
  | 'completed';

export interface WorkspaceRunState {
  workspaceId: string;
  state: AgentState;
  goal: string;
  startedAt: Date;
  round: number;
  currentPhase: ExecutionPhase;
  abortController: AbortController;
}

export interface WorkspaceRunParams {
  workspaceId: string;
  userGoal: string;
  historyMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  modelId?: string;
  sessionId?: string;
}