import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiService, ToolDefinition } from '../ai/ai.service.js';
import { repairToolCalls } from '../ai/tool-call-repair.js';
import { StreamingContextScrubber } from '../ai/context-manager.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { BackgroundReviewService } from '../memory/background-review.service.js';
import { CompactionService } from '../ai/compaction.service.js';
import { TodoStoreService } from '../tools/services/todo-store.service.js';
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
    @Inject(forwardRef(() => ArtifactService)) private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => MemoryService)) private readonly memoryService: MemoryService,
    @Inject(forwardRef(() => BackgroundReviewService)) private readonly backgroundReviewService: BackgroundReviewService,
    @Inject(forwardRef(() => CompactionService)) private readonly compactionService: CompactionService,
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventEmitter2)) private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TodoStoreService)) private readonly todoStore: TodoStoreService,
    @Inject(forwardRef(() => SessionAdmissionService)) private readonly sessionAdmissionService: SessionAdmissionService,
    @Inject(forwardRef(() => WorkspacePromptBuilderService)) private readonly promptBuilder: WorkspacePromptBuilderService,
    @Inject(forwardRef(() => TranscriptEngineService)) private readonly transcriptEngine: TranscriptEngineService,
    @Inject(forwardRef(() => ModelStreamNormalizerService)) private readonly streamNormalizer: ModelStreamNormalizerService,
    private readonly stateService: WorkspaceRunStateService,
    private readonly toolExecutor: WorkspaceToolExecutorService,
  ) {}

  /** Delegate physical sync to WorkspacePromptBuilderService */
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
      .then(() => {
        done = true;
        if (resolveEvent) resolveEvent(null);
      })
      .catch((err) => {
        done = true;
        if (resolveEvent) resolveEvent(null);
        this.logger.error(`Workspace agent stream failed: ${err.message}`);
        onEvent({ type: 'error', data: { message: err.message } });
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
        modifiedFiles: this.stateService.getModifiedFiles(workspaceId),
      });

      if (initial.injectionBlocked) {
        this.stateService.setState(runState, 'failed', onEvent);
        this.eventEmitter.emit('workspace.agent.failed', {
          workspaceId,
          goal: userGoal,
          reason: 'prompt_injection_blocked',
          timestamp: new Date(),
        });
        onEvent({
          type: 'error',
          data: {
            message: 'Input contains disallowed content. Please fix it and try again.',
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

      this.stateService.setPhase(runState, 'analyzing', onEvent);

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

          for await (const chunk of this.aiService.chatStream(
            messages,
            toolsToPass,
            modelId ? { preferredProviderId: modelId } : undefined,
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
            this.logger.error(`Non-streaming fallback failed: ${chatErr.message}`);
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
                .replace(/```(?:json|tool|function)?\s*\{[\s\S]*?\}\s*```/gi, '')
                .replace(/<\s*function\/[a-zA-Z0-9_-]+\s*>[\s\S]*?<\/\s*function\s*>/gi, '')
                .replace(/<\s*function:[a-zA-Z0-9_-]+\s*>[\s\S]*?<\/\s*function\s*>/gi, '')
                .replace(/<\s*tool_call\s*>[\s\S]*?<\/\s*tool_call\s*>/gi, '')
                .replace(/<\s*function_call\s*>[\s\S]*?<\/\s*function_call\s*>/gi, '')
                .replace(/<\s*function(?:[^>]*)>[\s\S]*?<\/\s*function\s*>/gi, '')
                .replace(/(?:Action|Tool|Function)\s*:\s*[a-zA-Z0-9_-]+\s*(?:Action Input|Arguments|Parameters|Input)\s*:\s*\{[\s\S]*?\}/gi, '')
                .trim();
            } else if (rawTextToSearch.includes('<|tool_call>')) {
              const toolCallMatch = rawTextToSearch.match(
                /<\|tool_call>call:([a-zA-Z0-9_]+)(.*?)(?:<tool_call\|>|<\|tool_call\|>|$)/s,
              );
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
                aiResponse.content = (aiResponse.content || '')
                  .replace(/<\|tool_call>.*?(?:<tool_call\|>|<\|tool_call\|>|$)/s, '')
                  .trim();
              }
            }
          }
        }

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
          const isConversationalOrRuleOrRecap =
            /\b(?:ekstrak|extract|baca|cek|analisis|analisa|ringkasan|summary|tampilkan|lihat|jelaskan|rekap|format|aturan|rule|canvas|contoh|mulai sekarang|ingat|bukan gitu|koreksi)\b/i.test(
              userGoal,
            );
          const hasExplicitMutationVerb =
            /\b(?:update file|edit file|ubah file|tulis file|buat file|write file|modify file|replace file|delete file|hapus file|patch file|simpan ke file)\b/i.test(
              userGoal,
            );
          const hasFileMutationIntent =
            hasExplicitMutationVerb && !isConversationalOrRuleOrRecap;

          const isEarlyRoundWithoutAction =
            runState.round <= 2 && hasFileMutationIntent && executedToolCount === 0;

          if (isEarlyRoundWithoutAction && nudgeAttempts < 2) {
            nudgeAttempts++;
            this.logger.log(
              `[Self-Correction] Round ${runState.round} produced 0 tool calls for file mutation task. Injecting action nudge (attempt ${nudgeAttempts})...`,
            );
            if (aiResponse.content) {
              messages.push({
                role: 'assistant',
                content: this.streamNormalizer.cleanseAssistantMessageForHistory(
                  aiResponse.content,
                ),
              });
            }
            messages.push({
              role: 'user',
              content:
                '[System Action Required] You did not execute any tool to apply the requested modifications. Please output a valid tool call (e.g. edit or write) using proper JSON format to apply the file changes directly now.',
            });
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
          this.logger.log('Workspace agent finished goal execution within round limit.');
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
            this.streamNormalizer.cleanseAssistantMessageForHistory(aiResponse.content) ||
            null,
          tool_calls: aiResponse.toolCalls,
        });

        const askUserToolCall = aiResponse.toolCalls.find(
          (tc) => tc.function.name === 'ask_user',
        );
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

        executedToolCount += toolExecResult.executedToolCount;
        mutationsApplied = toolExecResult.mutationsApplied;
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
          finalContent = finalContent || 'File modifications have been applied and verified.';
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
        this.logger.warn('Workspace agent reached max round limit without completion.');
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

      this.eventEmitter.emit('workspace.agent.completed', {
        workspaceId,
        goal: userGoal,
        finalContent: finalContent.substring(0, 200),
        messages: messages.map((m) => ({ role: m.role, content: m.content || '' })),
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
      this.stateService.deleteRunState(workspaceId);
      if (lease) {
        await lease.release().catch((e: any) =>
          this.logger.warn(`Failed to release lease: ${e.message}`),
        );
      }
    }
  }
}