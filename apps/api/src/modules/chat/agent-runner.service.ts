import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { AiService, ChatMessage } from '../ai/ai.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { BackgroundReviewService } from '../memory/background-review.service.js';
import { SelfHealingService } from '../ai/self-healing.service.js';
import { AutoMemoryService } from '../memory/auto-memory.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';
import { SessionAdmissionService } from './session-admission.service.js';
import { MessageService } from './message.service.js';
import { UserTurnTranscriptService } from './user-turn-transcript.service.js';
import { SessionStateEventsService, SessionEventType } from './session-state-events.service.js';
import { HarnessRegistryService } from './harness/harness-registry.service.js';
import { TodoStoreService } from '../tools/services/todo-store.service.js';
import { ContextQuarantine } from '../ai/context/context-quarantine.service.js';
import { InputProvenanceFactory } from '../ai/input-provenance.js';
import {
  createRunBudget,
  enterRunBudget,
} from '../ai/token-budget.service.js';
import { serializeToolCallHistory } from '../ai/sdk-transformer.util.js';

export interface AgentRunParams {
  chatId: string;
  userContent: string;
  chatMode?: 'chat' | 'workspace';
  workspaceId?: string | null;
  historyMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  idempotencyKey?: string;
  reasoningEffort?: string;
}

export interface AgentStreamEvent {
  type:
    | 'thinking'
    | 'tool_start'
    | 'tool_live_status'
    | 'tool_done'
    | 'text_delta'
    | 'canvas_event'
    | 'plan_created'
    | 'plan_step'
    | 'self_heal'
    | 'sub_agent_spawned'
    | 'sub_agent_completed'
    | 'done'
    | 'error';
  data: any;
}

export interface ToolOutputRecord {
  toolName: string;
  args: Record<string, any>;
  result: ToolResult;
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Inject(forwardRef(() => ToolRegistryService)) private readonly toolRegistryService: ToolRegistryService,
    @Inject(forwardRef(() => KnowledgeService)) private readonly knowledgeService: KnowledgeService,
    @Inject(forwardRef(() => ArtifactService)) private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => BackgroundReviewService)) private readonly backgroundReviewService: BackgroundReviewService,
    @Inject(forwardRef(() => SelfHealingService)) private readonly selfHealingService: SelfHealingService,
    @Inject(forwardRef(() => AutoMemoryService)) private readonly autoMemoryService: AutoMemoryService,
    @Optional() @Inject(forwardRef(() => SessionAdmissionService)) private readonly sessionAdmissionService?: SessionAdmissionService,
    @Optional() @Inject(forwardRef(() => MessageService)) private readonly messageService?: MessageService,
    @Optional() @Inject(forwardRef(() => UserTurnTranscriptService)) private readonly transcriptService?: UserTurnTranscriptService,
    @Optional() @Inject(forwardRef(() => SessionStateEventsService)) private readonly sessionEvents?: SessionStateEventsService,
    @Optional() @Inject(forwardRef(() => HarnessRegistryService)) private readonly harnessRegistry?: HarnessRegistryService,
    @Optional() @Inject(forwardRef(() => TodoStoreService)) private readonly todoStore?: TodoStoreService,
    @Optional() @Inject(forwardRef(() => ContextQuarantine)) private readonly quarantine?: ContextQuarantine,
  ) {}

  async getKnowledgeContext(userContent: string = ''): Promise<string> {
    try {
      const parts: string[] = [];

      // 1. If userContent is provided, search for relevant Knowledge node contents
      if (userContent.trim()) {
        const searchResult = await this.knowledgeService.searchNodes(userContent);
        if (
          searchResult &&
          searchResult !== 'No data found.' &&
          searchResult !== 'Node not found in the Knowledge Graph.'
        ) {
          parts.push(`=== RELEVANT KNOWLEDGE NODES ===\n${searchResult}`);
        }
      }

      // 2. Append high-level Knowledge Map Index
      const map = await this.knowledgeService.getKnowledgeMap();
      if (map && map !== 'Knowledge Graph is empty.') {
        parts.push(`=== KNOWLEDGE MAP INDEX ===\n${map}`);
      }

      return parts.join('\n\n');
    } catch {
      return '';
    }
  }

  async runAgentSync(params: AgentRunParams) {
    const lease = this.sessionAdmissionService
      ? await this.sessionAdmissionService.acquireAdmission(params.chatId)
      : { release: async () => {} };
    const runId = params.idempotencyKey || `sync:${params.chatId}:${Date.now()}`;
    try {
      if (params.idempotencyKey && this.messageService) {
        const assistant = await this.messageService.findByIdempotencyKey(
          `run:${params.idempotencyKey}:assistant`,
        );
        if (assistant) {
          return {
            content: assistant.content,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            toolOutputs: [],
            artifacts: [],
          };
        }
      }

      this.sessionEvents?.record(
        SessionEventType.AGENT_STARTED,
        params.chatId,
        params.chatMode || 'chat',
        { runId, sync: true },
      );
      this.harnessRegistry?.onAgentStart({
        chatId: params.chatId,
        runId,
        userContent: params.userContent,
      });

      const messages = this.messageService ? await this.messageService.findByChatHistoryId(params.chatId) : [];
      this.transcriptService?.createTurn(runId, params.chatId, messages.length);
      this.transcriptService?.markSentToProvider(runId);

      const result = await this.runAgentSyncInternal(params);

      const afterMessages = this.messageService ? await this.messageService.findByChatHistoryId(params.chatId) : [];
      this.transcriptService?.markRuntimePersisted(runId, afterMessages.length);
      this.transcriptService?.markApproved(runId);

      this.sessionEvents?.record(
        SessionEventType.AGENT_COMPLETED,
        params.chatId,
        params.chatMode || 'chat',
        { runId, sync: true, toolCount: result.toolOutputs.length },
      );
      this.harnessRegistry?.onAgentComplete({
        chatId: params.chatId,
        runId,
        result,
      });

      return result;
    } catch (error) {
      this.harnessRegistry?.onAgentError({
        chatId: params.chatId,
        runId,
        error,
      });
      this.transcriptService?.markFailed(runId);
      throw error;
    } finally {
      await lease.release();
    }
  }

  private async runAgentSyncInternal(params: AgentRunParams) {
    const { chatId, chatMode = 'chat', historyMessages } = params;

    const rawKnowledge = await this.getKnowledgeContext(params.userContent);
    const knowledgeContext = this.quarantine
      ? this.quarantine.sanitizeText(rawKnowledge, 'knowledge-map')
      : rawKnowledge;
    const contextForTools = historyMessages
      .slice(-3)
      .map(m => m.content)
      .join(' ') + ' ' + (params.userContent || '');
      
    const tools = this.toolRegistryService.getRelevantToolDefinitions(contextForTools);

    const systemPrompt = this.aiService.getSystemPrompt(
      chatMode,
      undefined,
      knowledgeContext,
      historyMessages,
      tools
    );

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Ensure user message is present (required by all providers)
    if (params.userContent && !messages.some((m) => m.role === 'user')) {
      messages.push({ role: 'user', content: params.userContent });
    }

    const toolOutputs: ToolOutputRecord[] = [];
    let finalContent = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const createdArtifactIds: string[] = [];

    const MAX_ROUNDS = 5;
    let reachedMaxRounds = true;
    const todoRunId = params.idempotencyKey || `chat:${chatId}`;
    const budget = createRunBudget();
    enterRunBudget(budget);
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // Inject current todo list (working memory) so LLM stays anchored
      const todoText = this.todoStore?.serialize(todoRunId);
      const todoIdx = messages.findIndex((m) => m.role === 'system' && m.content?.startsWith('=== TODO LIST ==='));
      if (todoText) {
        const todoMsg = { role: 'system' as const, content: todoText };
        if (todoIdx >= 0) messages[todoIdx] = todoMsg;
        else messages.push(todoMsg);
      } else if (todoIdx >= 0) {
        messages.splice(todoIdx, 1);
      }

      const aiResponse = await this.aiService.chat(messages, tools, { reasoningEffort: params.reasoningEffort });
      usage = aiResponse.usage;
      budget.consume(aiResponse.usage?.totalTokens || 0);
      if (budget.exceeded) {
        this.logger.warn(
          `Token budget exceeded: ${budget.used}/${budget.limit} tokens after round ${round + 1}. Stopping the run.`,
        );
        finalContent = `Run stopped: the token budget limit (${budget.limit.toLocaleString('en-US')} tokens) was exceeded after ${budget.used.toLocaleString('en-US')} tokens. Please break the task into smaller parts or continue in a new session.`;
        reachedMaxRounds = false;
        break;
      }

      // Accumulate thought process if present
      if (aiResponse.content) {
        finalContent += (finalContent ? '\n\n' : '') + aiResponse.content;
      }

      if (aiResponse.toolCalls.length === 0) {
        reachedMaxRounds = false;
        break;
      }

      // Intercept ask_user: if the AI explicitly wants to ask the user, stop the execution loop immediately!
      const askUserToolCall = aiResponse.toolCalls.find(tc => tc.function.name === 'ask_user');
      if (askUserToolCall) {
        let message = 'Please provide additional information to process this request.';
        try { 
          const args = JSON.parse(askUserToolCall.function.arguments || '{}');
          if (args.message) message = args.message;
        } catch {}
        
        finalContent = message;
        reachedMaxRounds = false;
        break;
      }

      messages.push({
        role: 'assistant',
        content: aiResponse.content || null,
        tool_calls: aiResponse.toolCalls,
      });

      // Notify harness of tool starts (in order)
      for (const tc of aiResponse.toolCalls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }
        this.harnessRegistry?.onToolStart({
          chatId,
          runId: params.idempotencyKey || '',
          toolName: tc.function.name,
          args,
        });
      }

      // Execute independent tool calls in parallel, like the stream path
      const executionPromises = aiResponse.toolCalls.map(async (toolCall) => {
        const funcName = toolCall.function.name;
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        let result: ToolResult;
        try {
          const safeArgs = params.workspaceId
            ? { ...args, workspaceId: params.workspaceId, runId: todoRunId }
            : { ...args, runId: todoRunId };
          if (params.workspaceId) {
            await this.selfHealingService.validateToolPaths(
              funcName,
              safeArgs,
              params.workspaceId,
            );
          }
          result = await this.toolRegistryService.executeTool(funcName, safeArgs);
        } catch (e) {
          const isIsolation = e.message?.includes('Access denied');
          result = {
            status: 'error',
            data: {},
            preview: isIsolation
              ? `Access denied: ${e.message}`
              : `Tool error: ${e.message}`,
            metadata: {
              toolName: funcName,
              displayName: funcName,
              executionTime: 0,
            },
            error: {
              code: isIsolation
                ? 'WORKSPACE_ISOLATION_VIOLATION'
                : 'EXECUTION_FAILED',
              message: e.message,
            },
          };
        }

        return { toolCall, funcName, args, result };
      });

      const executedResults = await Promise.all(executionPromises);

      // Emit in original tool_calls order so tool_call_id stays consistent
      for (const { toolCall, funcName, args, result } of executedResults) {
        this.harnessRegistry?.onToolResult({
          chatId,
          runId: params.idempotencyKey || '',
          toolName: funcName,
          args,
          result,
        });

        if (result.status === 'success' && result.metadata?.contentBase64) {
          const artifact = await this.artifactService.createFromAgent({
            type: this.mapFormatToArtifactType(
              result.metadata.format || 'document',
            ),
            name: result.metadata.filename || `export-${Date.now()}.file`,
            mimeType: result.metadata.mimeType || 'application/octet-stream',
            contentBase64: result.metadata.contentBase64,
            preview: result.preview,
            data: result.data,
            createdBy: `tool:${funcName}`,
            tags: [
              `chat:${chatId}`,
              `tool:${funcName}`,
              `format:${result.metadata.format || 'unknown'}`,
            ],
            lineage: [funcName],
          });
          createdArtifactIds.push(artifact.id);
        }

        toolOutputs.push({ toolName: funcName, args, result });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!finalContent && reachedMaxRounds) {
      this.logger.warn(`[AgentRunner] Reached max rounds (${MAX_ROUNDS}). Forcing final answer synthesis turn.`);
      try {
        const flattenedMessages = serializeToolCallHistory(messages);
        const finalSynthesis = await this.aiService.chat(flattenedMessages, undefined, { reasoningEffort: params.reasoningEffort });
        if (finalSynthesis.content) {
          finalContent = finalSynthesis.content;
        }
      } catch (err: any) {
        this.logger.warn(`[AgentRunner] Final synthesis fallback error: ${err.message}`);
      }
      if (!finalContent) {
        finalContent = 'Eksekusi selesai.';
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

    return {
      content: finalContent,
      usage,
      toolOutputs,
      artifacts,
    };
  }

  async runAgentStream(
    params: AgentRunParams,
    onEvent: (event: AgentStreamEvent) => void,
  ) {
    const lease = this.sessionAdmissionService
      ? await this.sessionAdmissionService.acquireAdmission(params.chatId)
      : { release: async () => {} };
    const runId = params.idempotencyKey || `stream:${params.chatId}:${Date.now()}`;
    try {
      if (params.idempotencyKey && this.messageService) {
        const assistant = await this.messageService.findByIdempotencyKey(
          `run:${params.idempotencyKey}:assistant`,
        );
        if (assistant) {
          onEvent({
            type: 'text_delta',
            data: assistant.content,
          });
          onEvent({
            type: 'done',
            data: {
              content: assistant.content,
              artifacts: [],
            },
          });
          return assistant.content;
        }
      }

      this.sessionEvents?.record(
        SessionEventType.AGENT_STARTED,
        params.chatId,
        params.chatMode || 'chat',
        { runId, sync: false },
      );
      this.harnessRegistry?.onAgentStart({
        chatId: params.chatId,
        runId,
        userContent: params.userContent,
      });

      const messages = this.messageService ? await this.messageService.findByChatHistoryId(params.chatId) : [];
      this.transcriptService?.createTurn(runId, params.chatId, messages.length);
      this.transcriptService?.markSentToProvider(runId);

      const result = await this.runAgentStreamInternal(params, onEvent);

      const afterMessages = this.messageService ? await this.messageService.findByChatHistoryId(params.chatId) : [];
      this.transcriptService?.markRuntimePersisted(runId, afterMessages.length);
      this.transcriptService?.markApproved(runId);

      this.sessionEvents?.record(
        SessionEventType.AGENT_COMPLETED,
        params.chatId,
        params.chatMode || 'chat',
        { runId, sync: false },
      );
      this.harnessRegistry?.onAgentComplete({
        chatId: params.chatId,
        runId,
        result,
      });

      return result;
    } catch (error) {
      this.harnessRegistry?.onAgentError({
        chatId: params.chatId,
        runId,
        error,
      });
      this.transcriptService?.markFailed(runId);
      throw error;
    } finally {
      await lease.release();
    }
  }

  private async runAgentStreamInternal(
    params: AgentRunParams,
    onEvent: (event: AgentStreamEvent) => void,
  ) {
    const { chatId, chatMode = 'chat', historyMessages } = params;

    try {
      onEvent({
        type: 'thinking',
        data: 'Processing message and gathering context...',
      });

      const rawKnowledge = await this.getKnowledgeContext(params.userContent);
      const knowledgeContext = this.quarantine
        ? this.quarantine.sanitizeText(rawKnowledge, 'knowledge-context')
        : rawKnowledge;
      const contextForTools = historyMessages
        .slice(-3)
        .map(m => m.content)
        .join(' ') + ' ' + (params.userContent || '');
        
      const tools = this.toolRegistryService.getRelevantToolDefinitions(contextForTools);

      const systemPrompt = this.aiService.getSystemPrompt(
        chatMode,
        undefined,
        knowledgeContext,
        historyMessages,
        tools
      );

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...historyMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      // Extract artifacts from this round
      const newArtifacts: string[] = [];

      let finalContent = '';
      const createdArtifactIds: string[] = [];
      const toolOutputs: Array<{ toolName: string; args: any; result: ToolResult }> = [];

      const MAX_ROUNDS = 5;
      let reachedMaxRounds = true;
      const todoRunId = params.idempotencyKey || `chat:${params.chatId}`;
      const budget = createRunBudget();
      enterRunBudget(budget);
      for (let round = 0; round < MAX_ROUNDS; round++) {
        // Inject current todo list (working memory) so LLM stays anchored
        const todoText = this.todoStore?.serialize(todoRunId);
        const todoIdx = messages.findIndex((m) => m.role === 'system' && m.content?.startsWith('=== TODO LIST ==='));
        if (todoText) {
          const todoMsg = { role: 'system' as const, content: todoText };
          if (todoIdx >= 0) messages[todoIdx] = todoMsg;
          else messages.push(todoMsg);
        } else if (todoIdx >= 0) {
          messages.splice(todoIdx, 1);
        }

        let aiResponse: { content: string; toolCalls: any[]; usage?: any } = { content: '', toolCalls: [] };
        try {
          let streamedText = '';
          const streamedToolCalls: any[] = [];
          for await (const chunk of this.aiService.chatStream(messages, tools, params.reasoningEffort)) {
            if (chunk.type === 'content' && chunk.content) {
              streamedText += chunk.content;
              onEvent({ type: 'text_delta', data: chunk.content });
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
        } catch (err: any) {
          this.logger.warn(`chatStream failed, falling back to chat: ${err.message}`);
          aiResponse = await this.aiService.chat(messages, tools, { reasoningEffort: params.reasoningEffort });
          if (aiResponse.content) {
            onEvent({ type: 'text_delta', data: aiResponse.content });
          }
        }

        budget.consume(aiResponse.usage?.totalTokens || 0);
        if (budget.exceeded) {
          this.logger.warn(
            `Token budget exceeded: ${budget.used}/${budget.limit} tokens after round ${round + 1}. Stopping the run.`,
          );
          finalContent = `Run stopped: the token budget limit (${budget.limit.toLocaleString('en-US')} tokens) was exceeded after ${budget.used.toLocaleString('en-US')} tokens. Please break the task into smaller parts or continue in a new session.`;
          onEvent({ type: 'error', data: finalContent });
          reachedMaxRounds = false;
          break;
        }

        if (aiResponse.toolCalls.length === 0) {
          finalContent = aiResponse.content;
          reachedMaxRounds = false;
          break;
        }

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

        messages.push({
          role: 'assistant',
          content: aiResponse.content || null,
          tool_calls: aiResponse.toolCalls,
        });

        // Execute all chat tools with self-healing (auto error recovery)
        if (aiResponse.toolCalls.length > 0) {
          onEvent({
            type: 'tool_start',
            data: {
              toolName: `parallel (${aiResponse.toolCalls.map((c) => c.function.name).join(', ')})`,
              args: {},
              timestamp: new Date().toISOString(),
            },
          });

          // Notify harness of tool starts
          for (const tc of aiResponse.toolCalls) {
            let args: Record<string, any> = {};
            try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }
            this.harnessRegistry?.onToolStart({
              chatId,
              runId: params.idempotencyKey || '',
              toolName: tc.function.name,
              args,
            });
          }

          // Execute each tool call; failures return to the model verbatim so
          // it can self-correct on the next round.
          const healingPromises = aiResponse.toolCalls.map(async (toolCall) => {
            let args: Record<string, any> = {};
            try {
              args = JSON.parse(toolCall.function.arguments || '{}');
            } catch {
              args = {};
            }

            const safeArgs = params.workspaceId
              ? { ...args, workspaceId: params.workspaceId, runId: todoRunId }
              : { ...args, runId: todoRunId };

            const result = await this.selfHealingService.executeWithIsolation(
              toolCall.function.name,
              safeArgs,
              params.workspaceId || undefined,
            );

            return { toolCall, result };
          });

          const healedResults = await Promise.all(healingPromises);

          for (const { toolCall, result } of healedResults) {
            const parsedArgs = (() => { try { return JSON.parse(toolCall.function.arguments || '{}'); } catch { return {}; } })();
            toolOutputs.push({ toolName: toolCall.function.name, args: parsedArgs, result });
            this.harnessRegistry?.onToolResult({
              chatId,
              runId: params.idempotencyKey || '',
              toolName: toolCall.function.name,
              args: parsedArgs,
              result,
            });
            if (result.status === 'success' && result.metadata?.contentBase64) {
              const artifact = await this.artifactService.createFromAgent({
                type: this.mapFormatToArtifactType(
                  result.metadata.format || 'document',
                ),
                name: result.metadata.filename || `export-${Date.now()}.file`,
                mimeType:
                  result.metadata.mimeType || 'application/octet-stream',
                contentBase64: result.metadata.contentBase64,
                preview: result.preview,
                data: result.data,
                createdBy: `tool:${toolCall.function.name}`,
                tags: [
                  `chat:${chatId}`,
                  `tool:${toolCall.function.name}`,
                  `format:${result.metadata.format || 'unknown'}`,
                ],
                lineage: [toolCall.function.name],
              });
              createdArtifactIds.push(artifact.id);
            }

            onEvent({
              type: 'tool_live_status',
              data: {
                toolName: toolCall.function.name,
                preview: result.preview,
                screenshot: (result.data as any)?.screenshot,
                data: result.data,
                timestamp: new Date().toISOString(),
              },
            });

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
      }

      if (!finalContent && reachedMaxRounds) {
        this.logger.warn(`[AgentRunner] Stream reached max rounds (${MAX_ROUNDS}). Forcing final answer synthesis turn.`);
        try {
          const flattenedMessages = serializeToolCallHistory(messages);
          const finalSynthesis = await this.aiService.chat(flattenedMessages, undefined, { reasoningEffort: params.reasoningEffort });
          if (finalSynthesis.content) {
            finalContent = finalSynthesis.content;
            if (onEvent) {
              onEvent({ type: 'text_delta', data: finalContent });
            }
          }
        } catch (err: any) {
          this.logger.warn(`[AgentRunner] Final synthesis fallback error: ${err.message}`);
        }
        if (!finalContent) {
          finalContent = 'Eksekusi selesai.';
          if (onEvent) {
            onEvent({ type: 'text_delta', data: finalContent });
          }
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

      // Persist assistant message to DB BEFORE emitting done event to frontend
      try {
        if (this.messageService) {
          await this.messageService.createMessage({
            chatHistoryId: params.chatId,
            role: 'assistant',
            content: finalContent,
            idempotencyKey: `run:${todoRunId}:assistant`,
            provenance: InputProvenanceFactory.internalSystem(),
          });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to persist assistant message: ${err.message}`);
      }

      onEvent({
        type: 'done',
        data: {
          content: finalContent,
          artifacts,
        },
      });

      // Fire-and-forget: Background review & distillation asynchronously without blocking response
      setImmediate(async () => {
        try {
          await this.backgroundReviewService.reviewAndLearn(
            messages.map((m) => ({ role: m.role, content: m.content || '' })),
          );
        } catch (err: any) {
          this.logger.debug(
            `Background review failed (non-critical): ${err.message}`,
          );
        }

        try {
          const distillResult = await this.autoMemoryService.checkAndDistill();
          if (distillResult.distilled) {
            this.logger.log(
              `Memory distilled: ${distillResult.count} entries compressed`,
            );
          }
        } catch (err: any) {
          this.logger.debug(
            `Memory distillation failed (non-critical): ${err.message}`,
          );
        }
      });

      return finalContent;
    } catch (error) {
      this.logger.error(`Stream execution failed: ${error.message}`);
      onEvent({ type: 'error', data: { message: error.message } });
      throw error;
    }
  }

  private mapFormatToArtifactType(
    format: string,
  ): 'document' | 'spreadsheet' | 'presentation' | 'image' {
    switch (format.toLowerCase()) {
      case 'xlsx':
      case 'csv':
        return 'spreadsheet';
      case 'pptx':
        return 'presentation';
      case 'png':
      case 'jpg':
      case 'jpeg':
        return 'image';
      default:
        return 'document';
    }
  }
}
