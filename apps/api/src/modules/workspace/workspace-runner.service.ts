import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AgentEventService } from './services/agent-event.service.js';
import { AiService, ToolDefinition } from '../ai/ai.service.js';
import { repairToolCalls } from '../ai/tool-call-repair.js';
import { StreamingContextScrubber } from '../ai/context-manager.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { BackgroundReviewService } from '../memory/background-review.service.js';
import { CompactionService } from '../ai/compaction.service.js';
import { TodoStoreService } from '../tools/services/todo-store.service.js';
import { request as httpsRequest } from 'https';
import { ExcelComService } from '../interaction/excel-com.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { createRunBudget, enterRunBudget } from '../ai/token-budget.service.js';
import { SessionAdmissionService } from '../chat/session-admission.service.js';
import { WorkspacePromptBuilderService } from './services/workspace-prompt-builder.service.js';
import { TranscriptEngineService } from './services/transcript-engine.service.js';
import { ModelStreamNormalizerService } from '../ai/services/model-stream-normalizer.service.js';
import {
  WorkspaceRunStateService,
  WorkspaceStreamEvent,
  WorkspaceRunState,
  AgentState,
  ExecutionPhase,
} from './services/workspace-run-state.service.js';
import { WorkspaceToolExecutorService } from './services/workspace-tool-executor.service.js';
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

export type {
  WorkspaceStreamEvent,
  WorkspaceRunState,
  AgentState,
  ExecutionPhase,
};

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

@Injectable()
export class WorkspaceRunnerService {
  private readonly logger = new Logger(WorkspaceRunnerService.name);
  private readonly scrubber = new StreamingContextScrubber();

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Inject(forwardRef(() => ArtifactService))
    private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => MemoryService))
    private readonly memoryService: MemoryService,
    @Inject(forwardRef(() => BackgroundReviewService))
    private readonly backgroundReviewService: BackgroundReviewService,
    @Inject(forwardRef(() => CompactionService))
    private readonly compactionService: CompactionService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AgentEventService))
    private readonly agentEvents: AgentEventService,
    @Inject(forwardRef(() => TodoStoreService))
    private readonly todoStore: TodoStoreService,
    @Inject(forwardRef(() => ExcelComService))
    private readonly excelComService: ExcelComService,
    @Inject(forwardRef(() => SessionAdmissionService))
    private readonly sessionAdmissionService: SessionAdmissionService,
    @Inject(forwardRef(() => WorkspacePromptBuilderService))
    private readonly promptBuilder: WorkspacePromptBuilderService,
    @Inject(forwardRef(() => TranscriptEngineService))
    private readonly transcriptEngine: TranscriptEngineService,
    @Inject(forwardRef(() => ModelStreamNormalizerService))
    private readonly streamNormalizer: ModelStreamNormalizerService,
    @Inject(WorkspaceRunStateService)
    private readonly stateService: WorkspaceRunStateService,
    @Inject(WorkspaceToolExecutorService)
    private readonly toolExecutor: WorkspaceToolExecutorService,
  ) {}

  /** Delegate physical sync to WorkspacePromptBuilderService */
  /** Recap-fill goal: fill/catat/update + explicit date or "today" + a sheet/file target. */
  private isRecapFillGoal(goal: string): boolean {
    return (
      /(?:isi|catat|input|update|rekap|fill)/i.test(goal || '') &&
      /(?:\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b|hari ini|today)/i.test(goal || '') &&
      /(?:\.xlsm|\.xlsx|sheet|laporan|rekap|excel)/i.test(goal || '')
    );
  }

  /**
   * RECAP-FILL PIPELINE (single-shot, opencode-style pipeline instead of an
   * agent loop): (1) read the template skeleton deterministically, (2) ONE
   * LLM extraction call producing semantic JSON against the real label list,
   * (3) execute fillTableColumn, (4) read-back verification. The model never
   * emits coordinates.
   */
  private async runRecapFillPipeline(p: {
    workspaceId: string;
    workspaceRootPath: string;
    goal: string;
    sourceFiles: Map<string, string>;
    onEvent: (e: { type: string; data?: any }) => void;
  }): Promise<string> {
    const { onEvent } = p;
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: reading template skeleton...', },
    });

    // ── 0. Resolve target workbook (the mentioned .xlsm/.xlsx) ──
    let targetFile = '';
    const sourceTexts: string[] = [];
    for (const [fname, content] of p.sourceFiles) {
      if (/\.(xlsm|xlsx)$/i.test(fname)) targetFile = fname;
      else sourceTexts.push(`=== ${fname} ===\n${content.slice(0, 6000)}`);
    }
    if (!targetFile) {
      for (const fname of p.sourceFiles.keys()) {
        if (/\.(xlsm|xlsx)$/i.test(fname)) targetFile = fname;
      }
    }
    if (!targetFile) throw new Error('No Excel target file found in mentions');

    const targetPath = `${p.workspaceRootPath}\\${targetFile}`;
    const sheetMatch = p.goal.match(/sheet\s+(\w+)/i);
    const skeleton = await this.excelComService.readTableSkeleton(
      targetPath,
      sheetMatch?.[1],
    );
    if ((skeleton as any).error)
      throw new Error((skeleton as any).error);

    // ── 1. Target date: explicit in goal, else today ──
    const dateMatch = p.goal.match(/\b(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\b/);
    const targetDate = dateMatch
      ? dateMatch[1]
      : new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

    // ── 2. ONE extraction call (no tools, JSON only) ──
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: extracting data (1 LLM call)...' },
    });
    // ── 2. ONE extraction call (no tools, JSON only) ──
    // Transport note: the Vercel-AI-SDK request path intermittently receives
    // Kenari's soft-refusal placeholder for this prompt, while raw HTTPS with
    // identical params succeeds (verified by probes). So extraction goes via
    // the proven raw-HTTPS Kenari caller first (provider-specific workaround,
    // isolated here), rotating models; aiService.chat is the last fallback.
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: extracting data (1 LLM call)...' },
    });
    const extraction = await (async () => {
      const sysMsg =
        'You are a financial data aggregator. Summarize the daily financial report into a valid JSON format. Expected JSON structure: {"rows":[{"label":"<exact label from LABELS list>","value":<integer amount in IDR>}],"details":["<individual transaction lines>"]}. Important instructions: 1. Labels MUST perfectly match the provided LABELS list. 2. Convert shorthand units to full numbers (e.g. 5 RB = 5000, 1.5 JT = 1500000). 3. Dots in numbers are thousand separators. 4. Only include rows that the user explicitly requested. 5. The "details" array should only contain individual transaction descriptions, not summary or total lines. 6. VERY IMPORTANT: Do not correct spelling in the details array; copy all text exactly verbatim from the source (e.g. if the source has a typo, KEEP the typo).';
      const usrMsg = `SOURCE DATA:\n${[...p.sourceFiles].map(([f, c]) => `=== ${f} ===\n${c.slice(0, 6000)}`).join('\n\n')}\n\nAVAILABLE LABELS (copy verbatim):\n${skeleton.labels.join('\n')}\n\nDATE HEADERS: ${skeleton.dates.join(', ')}\nTARGET DATE: ${targetDate}\n\nUSER REQUEST: ${p.goal}`;

      const parseJsonLoose = (rawText: string): any | null => {
        let t = rawText.trim();
        const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) t = fence[1].trim();
        const jm = t.match(/\{[\s\S]*\}/);
        if (!jm) return null;
        try {
          return JSON.parse(jm[0]);
        } catch {
          try {
            return JSON.parse(jm[0].replace(/,\s*([}\]])/g, '$1'));
          } catch {
            return null;
          }
        }
      };

      const rawKenariExtract = (
        model: string,
      ): Promise<{ ok: boolean; text: string }> =>
        new Promise((resolve) => {
          const payload = JSON.stringify({
            model,
            messages: [
              { role: 'system', content: sysMsg },
              { role: 'user', content: usrMsg },
            ],
            temperature: 0.2,
            max_tokens: 8192,
          });
          const req = httpsRequest(
            {
              host: 'kenari.id',
              path: '/v1/chat/completions',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.AI_API_KEY || ''}`,
                'Content-Length': Buffer.byteLength(payload),
              },
              timeout: 300000,
            },
            (res: any) => {
              let buf = '';
              res.setEncoding('utf8');
              res.on('data', (c: string) => (buf += c));
              res.on('end', () => {
                try {
                  const j = JSON.parse(buf);
                  const content = j.choices?.[0]?.message?.content;
                  if (content) {
                    resolve({ ok: !!content.trim(), text: content });
                  } else {
                    resolve({ ok: false, text: `API Error: ${JSON.stringify(j).slice(0, 200)}` });
                  }
                } catch {
                  resolve({ ok: false, text: buf.slice(0, 120) });
                }
              });
            },
          );
          req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, text: 'timeout' });
          });
          req.on('error', (e: any) =>
            resolve({ ok: false, text: e.message }),
          );
          req.write(payload);
          req.end();
        });

      let last = '';
      const extractionModels = [
        'gemini-1.5-flash',
        'deepseek-v4-flash',
      ];
      for (const model of extractionModels) {
        const direct = await rawKenariExtract(model);
        if (direct.ok) {
          const parsed = parseJsonLoose(direct.text);
          if (parsed) {
            this.logger.log(
              `[RecapFill] extraction OK via raw-kenari (${model})`,
            );
            return parsed;
          }
          last = `unparseable: ${direct.text.slice(0, 100)}`;
        } else {
          last = direct.text;
        }
        this.logger.warn(
          `[RecapFill] raw-kenari extraction failed (${model}): ${last.slice(0, 100)}`,
        );
        await new Promise((s) => setTimeout(s, 2000));
      }

      // Last resort: the AI-SDK path (may hit the aggregator refusal).
      for (const preferred of [undefined, 'deepseek-v4-flash']) {
        const r = await this.aiService.chat(
          [
            { role: 'system', content: sysMsg },
            { role: 'user', content: usrMsg },
          ],
          undefined,
          {
            reasoningEffort: 'low',
            ...(preferred ? { preferredProviderId: preferred } : {}),
          },
        );
        last = (r.content || '').trim();
        const parsed = parseJsonLoose(last);
        if (parsed) return parsed;
        this.logger.warn(
          `[RecapFill] sdk extraction failed (${preferred || 'default'}): ${last.slice(0, 100)}`,
        );
      }
      throw new Error(`Extraction failed: ${last.slice(0, 120)}`);
    })();

    if (!Array.isArray(extraction.rows) || extraction.rows.length === 0) {
      throw new Error('Extraction JSON has no rows');
    }

    // ── 3. Deterministic execution ──
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: writing (deterministic)...' },
    });
    const res = await this.excelComService.fillTableColumn(
      targetPath,
      sheetMatch?.[1] || skeleton.activeSheet,
      targetDate,
      extraction.rows,
      Array.isArray(extraction.details) ? extraction.details.map(String) : [],
    );
    if (!res.success && res.itemsFailed === res.itemsTotal) {
      throw new Error('All fill items failed');
    }

    // ── 4. Read-back verification of the filled cells ──
    const okRows = (res.results || []).filter(
      (r: any) => r.success && r.item === 'row',
    );
    const summary =
      `Kolom ${targetDate} di ${targetFile} (${skeleton.activeSheet}) terisi: ` +
      `${okRows.length}/${extraction.rows.length} label rows, ` +
      `${(res.results || []).filter((r: any) => r.success && r.item === 'detail').length} detail lines. ` +
      (res.itemsFailed > 0
        ? `Gagal: ${(res.results || []).filter((r: any) => !r.success).map((r: any) => r.label || r.error).join(', ')}.`
        : 'Semua posisi terverifikasi oleh harness.') +
      ` [pipeline: 1 LLM call]`;
    onEvent({ type: 'thinking', data: summary });
    return summary;
  }


  async syncWorkspacePhysicalFiles(workspaceId: string): Promise<void> {
    return this.promptBuilder.syncWorkspacePhysicalFiles(workspaceId);
  }

  /** Delegate context building to WorkspacePromptBuilderService */
  async buildWorkspaceContext(workspaceId: string): Promise<string> {
    return this.promptBuilder.buildWorkspaceContext(
      workspaceId,
      this.stateService.getModifiedFiles(workspaceId),
    );
  }

  getRunState(workspaceId: string): WorkspaceRunState | undefined {
    return this.stateService.getRunState(workspaceId);
  }

  isRunning(workspaceId: string): boolean {
    return this.stateService.isRunning(workspaceId);
  }

  abortRun(workspaceId: string, reason: string): boolean {
    return this.stateService.abortRun(workspaceId, reason);
  }

  getAllActiveRuns(): WorkspaceRunState[] {
    return this.stateService.getAllActiveRuns();
  }

  resolveApproval(workspaceId: string, approved: boolean): boolean {
    return this.stateService.resolveApproval(workspaceId, approved);
  }

  addSteeringInput(workspaceId: string, message: string): boolean {
    return this.stateService.addSteeringInput(workspaceId, message);
  }

  async *runWorkspaceAgentGenerator(
    params: WorkspaceRunParams,
  ): AsyncGenerator<WorkspaceStreamEvent> {
    const eventQueue: WorkspaceStreamEvent[] = [];
    let resolveEvent: ((value: WorkspaceStreamEvent | null) => void) | null =
      null;
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
      .then(() => {
        done = true;
        if (resolveEvent) resolveEvent(null);
      })
      .catch((err) => {
        this.logger.error(`Workspace agent stream failed: ${err.message}`);
        // Emit the terminal error BEFORE marking done, otherwise it lands in
        // the queue after the consumer loop has already exited.
        if (resolveEvent) {
          resolveEvent({ type: 'error', data: { message: err.message } });
        } else {
          eventQueue.push({ type: 'error', data: { message: err.message } });
        }
        done = true;
      });

    while (!done) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else {
        const event = await new Promise<WorkspaceStreamEvent | null>(
          (resolve) => {
            resolveEvent = resolve;
          },
        );
        if (event) yield event;
      }
    }

    await runPromise;
  }

  async runWorkspaceAgentStream(
    params: WorkspaceRunParams,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): Promise<string | undefined> {
    const { workspaceId, userGoal, historyMessages, modelId } = params;

    let lease: any;
    try {
      lease = await this.sessionAdmissionService.acquireAdmission(workspaceId);
    } catch {
      onEvent({
        type: 'error',
        data: {
          message: 'Workspace is busy processing another request. Please wait.',
        },
      });
      return;
    }

    const runState = this.stateService.createRunState(workspaceId, userGoal);

    try {
      this.stateService.setState(runState, 'running', onEvent);
      this.stateService.setPhase(runState, 'scanning', onEvent);
      this.stateService.resetSessionTracks(workspaceId);
      this.todoStore.clear(workspaceId);

      this.agentEvents.emitStarted({
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
        modifiedFiles: this.stateService.getModifiedFiles(workspaceId),
        modelId,
      });

      if (initial.injectionBlocked) {
        this.stateService.setState(runState, 'failed', onEvent);
        this.agentEvents.emitFailed({
          workspaceId,
          goal: userGoal,
          reason: 'prompt_injection_blocked',
          timestamp: new Date(),
        });
        onEvent({
          type: 'error',
          data: {
            message:
              'Input contains disallowed content. Please fix it and try again.',
          },
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
        hasMutationIntent,
      } = initial;
      this.stateService.setMentionedFiles(
        workspaceId,
        new Set(mentionedFileContents.keys()),
      );

      if (workspaceRootPath) {
        this.transcriptEngine
          .appendEvent(workspaceRootPath, sessionId, 'session_start', {
            userGoal,
            modelId,
            timestamp: new Date().toISOString(),
          })
          .catch(() => {});
      }

      if (runState.abortController.signal.aborted) {
        this.stateService.setState(runState, 'aborting', onEvent);
        this.agentEvents.emitAborted({
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

      this.stateService.setPhase(runState, 'analyzing', onEvent);

      let finalContent = '';
      const createdArtifactIds: string[] = [];
      const MAX_ROUNDS = 25;
      let reachedMaxRounds = true;
      let executedToolCount = 0;
      let nudgeAttempts = 0;
      let completenessNudged = false;
      let officeMutationApplied = false;
      let forceFillNext = false;
      let officeMutationTool = '';
      const runStartTime = Date.now();
      let mutationsApplied = 0;
      let noProgressRounds = 0;
      const touchedFiles = new Set<string>();
      const budget = createRunBudget();
      enterRunBudget(budget);


      // ═══ RECAP-FILL PIPELINE (single-shot) ═══
      // Structured form-filling is a PIPELINE, not an agent loop: ONE
      // extraction call + deterministic execution. 16 agent-loop iterations
      // proved models cannot reliably emit positions at any tier; they DO
      // extract semantics correctly every time. Total cost: ~1 LLM call.
      if (
        this.isRecapFillGoal(safeGoal) &&
        workspaceRootPath &&
        mentionedFileContents.size > 0
      ) {
        try {
          const summary = await this.runRecapFillPipeline({
            workspaceId,
            workspaceRootPath,
            goal: safeGoal,
            sourceFiles: mentionedFileContents,
            onEvent,
          });
          finalContent = summary;
          onEvent({ type: 'text_delta', data: summary });
          onEvent({
            type: 'done',
            data: { content: summary, artifacts: createdArtifactIds },
          });
          reachedMaxRounds = false;
          this.stateService.setState(runState, 'completed', onEvent);
          return;
        } catch (pipeErr: any) {
          this.logger.warn(
            `[RecapFill] pipeline failed (${pipeErr.message}) — falling back to agent loop`,
          );
        }
      }

      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (runState.abortController.signal.aborted) {
          this.stateService.setState(runState, 'aborting', onEvent);
          onEvent({
            type: 'error',
            data: { message: 'Analysis cancelled by user.' },
          });
          return;
        }
        runState.round = round + 1;

        // Inject todo list
        const todoText = this.todoStore.serialize(workspaceId);
        const todoIdx = messages.findIndex(
          (m) =>
            m.role === 'system' && m.content?.startsWith('=== TODO LIST ==='),
        );
        if (todoText) {
          const todoMsg = { role: 'system' as const, content: todoText };
          if (todoIdx >= 0) messages[todoIdx] = todoMsg;
          else messages.push(todoMsg);
        } else if (todoIdx >= 0) {
          messages.splice(todoIdx, 1);
        }

        if (runState.round > 1) {
          this.stateService.setPhase(runState, 'analyzing', onEvent);
        }

        const isFinalRound = round >= MAX_ROUNDS - 1;
        const toolsToPass = isFinalRound ? undefined : tools;
        if (isFinalRound) {
          messages.push({
            role: 'user',
            content:
              'CRITICAL - MAXIMUM STEPS REACHED: Tools are now disabled. Please provide a clear final text summary of all work completed so far and any remaining recommendations.',
          });
        }

        const roundStart = Date.now();
        let aiResponse: { content: string; toolCalls: any[]; usage?: any } = {
          content: '',
          toolCalls: [],
        };
        let isStreamed = false;
        let streamedReasoning = '';

        try {
          let streamedText = '';
          const streamedToolCalls: any[] = [];

          // Native forced tool_choice (opencode parity): when the user asked
          // for confirmation first, round 0 MUST call ask_user â€” provider-side
          // enforcement beats prompt pleading on small models.
          const clarifyRequested =
            round === 0 &&
            /(?:tanya|bertanya|ask[\s_-]*user|konfirmasi|clarif)/i.test(
              safeGoal || '',
            ) &&
            (toolsToPass || []).some((t) => t.function.name === 'ask_user');
          // (b) fill forcing happens AFTER the read-only nudge sets
          // forceFillNext — by then the model has real sheet context, so its
          // fill_table_column JSON is grounded (forcing at round 0 produced
          // hallucinated args because the model hadn't read anything yet).
          const forcedTool = clarifyRequested
            ? 'ask_user'
            : forceFillNext &&
                (toolsToPass || []).some(
                  (t) => t.function.name === 'fill_table_column',
                )
              ? 'fill_table_column'
              : undefined;

          for await (const chunk of this.aiService.chatStream(
            messages,
            toolsToPass,
            {
              ...(modelId ? { preferredProviderId: modelId } : {}),
              // Cancellation reaches the upstream provider request directly
              signal: runState.abortController.signal,
              ...(forcedTool ? { forceTool: forcedTool } : {}),
            },
          )) {
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
          // One forced round per nudge: reset so the next round is free
          // (the model may verify, correct, or summarize without coercion).
          forceFillNext = false;
        } catch (streamErr: any) {
          this.logger.warn(
            `chatStream failed, falling back to chat: ${streamErr.message}`,
          );
          aiResponse = await this.aiService.chat(
            messages,
            tools,
            modelId ? { preferredProviderId: modelId } : undefined,
          );
        }

        if (
          (aiResponse.content || '').trim().length === 0 &&
          (aiResponse.toolCalls?.length ?? 0) === 0 &&
          streamedReasoning.trim().length === 0
        ) {
          try {
            aiResponse = await this.aiService.chat(
              messages,
              toolsToPass,
              modelId ? { preferredProviderId: modelId } : undefined,
            );
          } catch (chatErr: any) {
            this.logger.error(
              `Non-streaming fallback failed: ${chatErr.message}`,
            );
          }
        }

        this.logger.log(
          `[round] ${runState.round} took ${Date.now() - roundStart}ms; toolCalls=${aiResponse.toolCalls?.length ?? 0} usage=${JSON.stringify(aiResponse.usage)}`,
        );

        aiResponse.toolCalls = aiResponse.toolCalls || [];

        // Fallback parser for leaked raw tool syntax
        if (aiResponse.toolCalls.length === 0) {
          const rawTextToSearch = aiResponse.content || streamedReasoning;
          if (rawTextToSearch) {
            const repaired = repairToolCalls(rawTextToSearch);
            if (repaired.length > 0) {
              this.logger.log(
                `[WorkspaceRunner] Repaired ${repaired.length} tool call(s) from streamed text/reasoning`,
              );
              aiResponse.toolCalls = repaired;
              aiResponse.content = (aiResponse.content || '')
                .replace(
                  /```(?:json|tool|function)?\s*\{[\s\S]*?\}\s*```/gi,
                  '',
                )
                .replace(
                  /<\s*function\/[a-zA-Z0-9_-]+\s*>[\s\S]*?<\/\s*function\s*>/gi,
                  '',
                )
                .replace(
                  /<\s*function:[a-zA-Z0-9_-]+\s*>[\s\S]*?<\/\s*function\s*>/gi,
                  '',
                )
                .replace(/<\s*tool_call\s*>[\s\S]*?<\/\s*tool_call\s*>/gi, '')
                .replace(
                  /<\s*function_call\s*>[\s\S]*?<\/\s*function_call\s*>/gi,
                  '',
                )
                .replace(
                  /<\s*function(?:[^>]*)>[\s\S]*?<\/\s*function\s*>/gi,
                  '',
                )
                .replace(
                  /(?:Action|Tool|Function)\s*:\s*[a-zA-Z0-9_-]+\s*(?:Action Input|Arguments|Parameters|Input)\s*:\s*\{[\s\S]*?\}/gi,
                  '',
                )
                .trim();
            } else if (rawTextToSearch.includes('<|tool_call>')) {
              const toolCallMatch = rawTextToSearch.match(
                /<\|tool_call>call:([a-zA-Z0-9_]+)(.*?)(?:<tool_call\|>|<\|tool_call\|>|$)/s,
              );
              if (toolCallMatch) {
                const funcName = toolCallMatch[1];
                let rawArgs = toolCallMatch[2].trim();
                rawArgs = rawArgs.replace(/<\|">/g, '"');
                rawArgs = rawArgs.replace(
                  /([{\[,]\s*)([a-zA-Z0-9_]+)\s*:/g,
                  '$1"$2":',
                );
                aiResponse.toolCalls.push({
                  id: `call_fallback_${Date.now()}`,
                  type: 'function',
                  function: {
                    name: funcName,
                    arguments: rawArgs,
                  },
                });
                aiResponse.content = (aiResponse.content || '')
                  .replace(
                    /<\|tool_call>.*?(?:<tool_call\|>|<\|tool_call\|>|$)/s,
                    '',
                  )
                  .trim();
              }
            }
          }
        }

        // Streaming responses often carry no usage â€” estimate from actual
        // output (~4 chars/token) so runaway loops still trip the budget.
        const streamedUsage =
          aiResponse.usage?.totalTokens ||
          Math.ceil((aiResponse.content || '').length / 4) +
            Math.ceil(JSON.stringify(aiResponse.toolCalls).length / 4);
        budget.consume(streamedUsage);
        if (budget.exceeded) {
          this.logger.warn(
            `Token budget exceeded: ${budget.used}/${budget.limit} tokens after round ${runState.round}. Stopping the run.`,
          );
          finalContent = `Run stopped: the token budget limit (${budget.limit.toLocaleString('en-US')} tokens) was exceeded after ${budget.used.toLocaleString('en-US')} tokens. Please break the task into smaller parts or continue in a new session.`;
          onEvent({
            type: 'error',
            data: {
              message: finalContent,
              budget: { used: budget.used, limit: budget.limit },
            },
          });
          reachedMaxRounds = false;
          break;
        }

        if (aiResponse.toolCalls.length === 0) {
          // The AI Intent Classifier already determined if this is a mutation task
          const hasFileMutationIntent = hasMutationIntent;

          const isEarlyRoundWithoutAction =
            runState.round <= 2 &&
            hasFileMutationIntent &&
            executedToolCount === 0;

          if (isEarlyRoundWithoutAction && nudgeAttempts < 2) {
            nudgeAttempts++;
            this.logger.log(
              `[Self-Correction] Round ${runState.round} produced 0 tool calls for file mutation task. Injecting smart nudge (attempt ${nudgeAttempts})...`,
            );
            if (aiResponse.content) {
              messages.push({
                role: 'assistant',
                content:
                  this.streamNormalizer.cleanseAssistantMessageForHistory(
                    aiResponse.content,
                  ),
              });
            }
            const availableTools = tools
              .map((t) => `\`${t.function.name}\``)
              .join(', ');
            // Build context-rich nudge with file info and original request
            const mentionedFiles = Array.from(
              this.stateService.getMentionedFiles(workspaceId) || [],
            );
            const fileHint =
              mentionedFiles.length > 0
                ? `\nTarget file(s): ${mentionedFiles.map((f) => `"${f}"`).join(', ')}.`
                : '';
            messages.push({
              role: 'user',
              content:
                `[System Action Required] You did not execute any tool to apply the requested modifications. ` +
                `Available tools: ${availableTools}.${fileHint}\n` +
                `Original user request: "${safeGoal}"\n` +
                `You MUST call the appropriate tool NOW with the correct filePath and parameters. ` +
                `Start by reading the file if you haven't already, then apply the edits.`,
            });
            continue;
          }

          // Act -> check -> fix loop (opencode parity): after ANY Office
          // mutation, force one confirming pass before the run may finish.
          // Small models skip aggregate updates or misplace writes; a single
          // mandatory re-read catches both without trusting a single shot.
          //
          // Companion guard: on a mutation goal, a run that only READ (or did
          // nothing) and then tries to finish is NOT done â€” force the write.
          const officeReadButNotWritten =
            hasMutationIntent &&
            executedToolCount > 0 &&
            !officeMutationApplied;
          if (
            !completenessNudged &&
            hasMutationIntent &&
            (officeMutationApplied || officeReadButNotWritten) &&
            nudgeAttempts < 5
          ) {
            completenessNudged = true;
            nudgeAttempts++;
            const mode = officeMutationApplied
              ? 'mutation done â€” verify & complete aggregates'
              : 'only read so far â€” APPLY the requested writes now';
            this.logger.log(
              `[Self-Correction] Completeness nudge (${mode})...`,
            );
            if (aiResponse.content) {
              messages.push({
                role: 'assistant',
                content:
                  this.streamNormalizer.cleanseAssistantMessageForHistory(
                    aiResponse.content,
                  ),
              });
            }
            messages.push({
              role: 'user',
              content: officeMutationApplied
                ? officeMutationTool === 'desktop_excel_edit'
                  ? `[Verify-and-Correct] Do this EXACT sequence now, as tool calls (no narration between): ` +
                    `(1) read_range the FULL used width of the modified sheet (all columns, from row 1 to the last used row). ` +
                    `(2) From that read-back, list every mismatch vs the original request â€” wrong row, wrong column, missing value, ` +
                    `wrong scale (e.g. wrote 2.771 instead of 2.771.000). ` +
                    `(3) Fix EVERY mismatch with write_cell using rowLabel + columnDate/columnLetter targeting (never raw coordinates on this template). ` +
                    `(4) Repeat read_range + fix until a full read-back matches the request, then reply with the literal line ` +
                    `"VERIFIED: <jumlah sel diperiksa> cells checked" plus a one-line summary.`
                  : officeMutationTool === 'desktop_word_edit'
                    ? `[Completeness Check] Before finishing: re-read the document you just modified and verify it fully matches the request â€” ` +
                      `every requested replacement, paragraph, or table present in the right place, and the rest of the document untouched. ` +
                      `If anything is missing or wrong, fix it now with desktop_word_edit, then confirm.`
                    : `[Completeness Check] Before finishing: re-read the presentation you just modified and verify every requested slide/` +
                      `text change is in place and the rest of the deck is untouched. If anything is missing, fix it now with desktop_ppt_edit, then confirm.`
                : `[Action Required] You only inspected the file â€” the requested changes are NOT written yet. ` +
                  `Using what you just read, call the same edit tool NOW and write every value the user asked for. ` +
                  `MECHANICAL RECIPE (follow exactly, no coordinate guessing): ` +
                  `STEP 1 â€” for EACH value, call find_cell with matchValue set to that row's label text (e.g. the label of the total row, ` +
                  `or the category name) to get its exact row number; also read the table's header/date row full-width once to fix the target column letter. ` +
                  `STEP 2 â€” write each value with write_cell cell="<targetColumnLetter><rowFromFindCell>" using the row number find_cell returned. ` +
                  `Never compute row numbers yourself; always take them from find_cell results. ` +
                  `Then confirm what you wrote.`,
            });
            // Round berikutnya DIPAKSA memakai fill_table_column (posisi
            // deterministik oleh harness) — model tinggal mengirim data
            // semantiknya; koordinat tidak lagi diperlukan.
            if (
              (toolsToPass || []).some(
                (t) => t.function.name === 'fill_table_column',
              )
            ) {
              forceFillNext = true;
            }
            continue;
          }

          finalContent = this.scrubber.scrub(aiResponse.content);
          if (!isStreamed) {
            onEvent({ type: 'text_delta', data: finalContent });
          }
          onEvent({
            type: 'done',
            data: { content: finalContent, artifacts: createdArtifactIds },
          });
          reachedMaxRounds = false;
          this.logger.log(
            'Workspace agent finished goal execution within round limit.',
          );
          break;
        }

        if (runState.round > 1 || aiResponse.toolCalls.length > 1) {
          onEvent({
            type: 'plan_created',
            data: {
              goal: userGoal,
              steps: aiResponse.toolCalls.map((tc, idx) => ({
                id: `step-${idx + 1}`,
                title: `${tc.function.name}: ${JSON.stringify(tc.function.arguments).slice(0, 50)}...`,
                tool: tc.function.name,
                status: 'pending',
              })),
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
          content:
            this.streamNormalizer.cleanseAssistantMessageForHistory(
              aiResponse.content,
            ) || null,
          tool_calls: aiResponse.toolCalls,
        });

        const askUserToolCall = aiResponse.toolCalls.find(
          (tc) => tc.function.name === 'ask_user',
        );
        if (askUserToolCall) {
          let message =
            'Please provide additional information to process this request.';
          try {
            const args = JSON.parse(askUserToolCall.function.arguments || '{}');
            if (args.message) message = args.message;
          } catch {}

          finalContent = message;
          onEvent({ type: 'text_delta', data: finalContent });
          reachedMaxRounds = false;
          break;
        }

        const toolExecResult = await this.toolExecutor.executeRoundTools(
          aiResponse.toolCalls,
          {
            workspaceId,
            sessionId,
            safeGoal,
            workspaceRootPath,
            runState,
            tools,
            messages,
            mutationsApplied,
            noProgressRounds,
            runStartTime,
            touchedFiles,
            createdArtifactIds,
          },
          onEvent,
        );

        const officeToolUsed = aiResponse.toolCalls.find((tc) =>
          /^(?:desktop_excel_edit|desktop_word_edit|desktop_ppt_edit)$/.test(
            tc.function?.name || '',
          ),
        );
        if (officeToolUsed) {
          officeMutationTool = officeToolUsed.function?.name || officeMutationTool;
        }
        executedToolCount += toolExecResult.executedToolCount;
        mutationsApplied = toolExecResult.mutationsApplied;
        // Accurate mutation signal: executor now counts read-only Office
        // inspections as non-mutations, so mutationsApplied is trustworthy.
        if (toolExecResult.mutationsApplied > 0) {
          officeMutationApplied = true;
        }
        noProgressRounds = toolExecResult.noProgressRounds;

        if (toolExecResult.concludeRun) {
          finalContent =
            toolExecResult.concludeContent ||
            aiResponse.content?.trim() ||
            'Autonomous workspace task completed.';
          reachedMaxRounds = false;
          break;
        }

        if (mutationsApplied > 0 && noProgressRounds >= 2) {
          this.logger.log(
            `[WorkspaceRunner] Concluding run: ${mutationsApplied} mutation(s) applied and verified across rounds.`,
          );
          finalContent =
            finalContent ||
            'File modifications have been applied and verified.';
          reachedMaxRounds = false;
          break;
        }

        const compactResult = await this.compactionService.compactHistory(
          messages,
          modelCtx.contextWindow,
        );
        if (compactResult.wasCompacted) {
          messages.length = 0;
          messages.push(...compactResult.compactedMessages);
        }

        const steering = this.stateService.consumeSteeringInput(workspaceId);
        if (steering) {
          messages.push({
            role: 'user',
            content: steering.message,
          });
          this.logger.log(
            `Steering input injected for workspace ${workspaceId}: "${steering.message.substring(0, 100)}"`,
          );
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

      this.stateService.setPhase(runState, 'completed', onEvent);
      this.stateService.setState(runState, 'completed', onEvent);

      this.agentEvents.emitCompleted({
        workspaceId,
        goal: userGoal,
        finalContent: finalContent.substring(0, 200),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content || '',
        })),
        artifactsCount: artifacts.length,
        timestamp: new Date(),
      });

      const modified = this.stateService.getModifiedFiles(workspaceId);
      const memoryDetails = {
        goal: userGoal,
        result: finalContent.substring(0, 500),
        modifiedFiles: modified.map((f) => f.filename),
        totalRounds: runState.round,
        timestamp: new Date().toISOString(),
      };

      setImmediate(async () => {
        try {
          await this.prisma.workspace
            .update({
              where: { id: workspaceId },
              data: {
                analysisResult: finalContent,
                analyzedAt: new Date(),
              },
            })
            .catch((e) =>
              this.logger.warn(`Failed to cache analysis result: ${e.message}`),
            );

          let saveDomain = 'generic';
          try {
            const ws = await this.prisma.workspace.findUnique({
              where: { id: workspaceId },
              select: { businessType: true },
            });
            if (ws?.businessType) saveDomain = ws.businessType;
          } catch {}

          await this.memoryService
            .recordWorkspaceHistory(
              workspaceId,
              `Goal: ${userGoal}\nResult: ${finalContent.substring(0, 500)}`,
              saveDomain,
            )
            .catch(() => {});

          await this.memoryService
            .remember({
              type: 'run_summary',
              key: `run_${workspaceId}_${Date.now()}`,
              content: JSON.stringify(memoryDetails),
              source: 'auto',
              importance: 6,
              domain: saveDomain,
              workspaceId,
            })
            .catch(() => {});

          await this.backgroundReviewService
            .reviewAndLearn(
              messages.map((m) => ({ role: m.role, content: m.content || '' })),
              workspaceId,
              saveDomain,
            )
            .catch(() => {});
        } catch (e: any) {
          this.logger.warn(`Background post-processing warning: ${e.message}`);
        }
      });

      return finalContent;
    } catch (error: any) {
      this.stateService.setState(runState, 'failed', onEvent);

      this.agentEvents.emitFailed({
        workspaceId,
        goal: userGoal,
        error: error?.message || 'Unknown error',
        timestamp: new Date(),
      });

      this.logger.error(`Workspace stream execution failed: ${error.message}`);
      const friendly = /rate limit|429|free-models-per-day/i.test(error.message)
        ? 'The AI server is rate-limited (HTTP 429). Try again in a few minutes or use a paid API key.'
        : error.message;
      onEvent({
        type: 'error',
        data: { message: friendly, code: 'AI_PROVIDER_ERROR' },
      });
      throw error;
    } finally {
      this.stateService.deleteRunState(workspaceId);
      if (lease) {
        await lease
          .release()
          .catch((e: any) =>
            this.logger.warn(`Failed to release lease: ${e.message}`),
          );
      }
    }
  }
}






