import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AiService, ChatMessage } from '../ai/ai.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { SelfHealingService } from '../ai/self-healing.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';
import { currentRunBudget } from '../ai/token-budget.service.js';
/**
 * SubAgentRunnerService — Isolated sub-agent execution engine.
 *
 * Spawns independent sub-agents that run in parallel with their own
 * tool-scoped execution loop. Each sub-agent receives a task description,
 * a restricted set of allowed tools, and returns an aggregated result
 * back to the parent agent.
 *
 * Design:
 * - Sub-agents do NOT share chat history with the parent agent.
 * - Sub-agents have their own isolated message context.
 * - Sub-agents are scoped to a subset of tools (security boundary).
 * - Multiple sub-agents can run concurrently via Promise.all().
 */

export interface SubAgentTask {
  /** Unique identifier for this sub-agent task */
  taskId: string;
  /** Human-readable name for the task (shown in UI) */
  taskName: string;
  /** Detailed task description / instruction for the sub-agent */
  taskDescription: string;
  /** List of allowed tool names (empty = all tools allowed) */
  allowedTools?: string[];
  /** Maximum execution rounds for the sub-agent (default: 5) */
  maxRounds?: number;
  /** Additional context to inject into the sub-agent's system prompt */
  additionalContext?: string;
  /** The workspace ID this sub-agent operates in (used for safe path validation) */
  workspaceId?: string;
}

export interface SubAgentResult {
  taskId: string;
  taskName: string;
  status: 'success' | 'error' | 'timeout';
  /** Final text response from the sub-agent */
  content: string;
  /** Tool outputs produced during execution */
  toolOutputs: Array<{
    toolName: string;
    args: Record<string, any>;
    preview: string;
    status: string;
  }>;
  /** Execution metadata */
  metadata: {
    rounds: number;
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
  /** Error message if status is 'error' */
  error?: string;
}

export type SubAgentProgressCallback = (event: {
  taskId: string;
  taskName: string;
  type: 'spawned' | 'tool_start' | 'tool_done' | 'completed' | 'error';
  data?: any;
}) => void;

@Injectable()
export class SubAgentRunnerService {
  private readonly logger = new Logger(SubAgentRunnerService.name);

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly selfHealingService: SelfHealingService,
  ) {}

  /**
   * Spawn a single sub-agent that runs an isolated execution loop.
   */
  async spawnSubAgent(
    task: SubAgentTask,
    onProgress?: SubAgentProgressCallback,
  ): Promise<SubAgentResult> {
    const startedAt = new Date();
    this.logger.log(`Sub-agent spawned: [${task.taskId}] ${task.taskName}`);

    onProgress?.({
      taskId: task.taskId,
      taskName: task.taskName,
      type: 'spawned',
      data: { description: task.taskDescription },
    });

    try {
      const result = await this.executeSubAgentLoop(task, onProgress);

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      this.logger.log(
        `Sub-agent completed: [${task.taskId}] ${task.taskName} (${durationMs}ms, ${result.toolOutputs.length} tools used)`,
      );

      onProgress?.({
        taskId: task.taskId,
        taskName: task.taskName,
        type: 'completed',
        data: { content: result.content, durationMs },
      });

      return {
        taskId: task.taskId,
        taskName: task.taskName,
        status: 'success',
        content: result.content,
        toolOutputs: result.toolOutputs,
        metadata: {
          rounds: result.rounds,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs,
        },
      };
    } catch (error: any) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      this.logger.error(
        `Sub-agent failed: [${task.taskId}] ${task.taskName} — ${error.message}`,
      );

      onProgress?.({
        taskId: task.taskId,
        taskName: task.taskName,
        type: 'error',
        data: { error: error.message },
      });

      return {
        taskId: task.taskId,
        taskName: task.taskName,
        status: 'error',
        content: '',
        toolOutputs: [],
        metadata: {
          rounds: 0,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs,
        },
        error: error.message,
      };
    }
  }

  /**
   * Spawn multiple sub-agents in parallel and wait for all to complete.
   */
  async spawnParallel(
    tasks: SubAgentTask[],
    onProgress?: SubAgentProgressCallback,
  ): Promise<SubAgentResult[]> {
    this.logger.log(
      `Spawning ${tasks.length} sub-agents in parallel: ${tasks.map((t) => t.taskName).join(', ')}`,
    );

    const results = await Promise.allSettled(
      tasks.map((task) => this.spawnSubAgent(task, onProgress)),
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      }
      return {
        taskId: tasks[i].taskId,
        taskName: tasks[i].taskName,
        status: 'error' as const,
        content: '',
        toolOutputs: [],
        metadata: {
          rounds: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
        },
        error: r.reason?.message || 'Unknown error',
      };
    });
  }

  /**
   * Internal isolated execution loop for a sub-agent.
   * Similar to AgentRunnerService.runAgentSyncInternal but with:
   * - Isolated message context (no chat history sharing)
   * - Tool scoping (only allowed tools)
   * - Custom system prompt for sub-agent delegation
   */
  private async executeSubAgentLoop(
    task: SubAgentTask,
    onProgress?: SubAgentProgressCallback,
  ): Promise<{
    content: string;
    toolOutputs: Array<{
      toolName: string;
      args: Record<string, any>;
      preview: string;
      status: string;
    }>;
    rounds: number;
  }> {
    const maxRounds = task.maxRounds || 5;

    // Build scoped tool definitions
    const allTools = this.toolRegistryService.getToolDefinitions();
    const tools =
      task.allowedTools && task.allowedTools.length > 0
        ? allTools.filter((t: any) =>
            task.allowedTools!.includes(t.function?.name || t.name),
          )
        : allTools;

    // Build isolated sub-agent system prompt
    const systemPrompt = this.buildSubAgentSystemPrompt(task);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task.taskDescription },
    ];

    const toolOutputs: Array<{
      toolName: string;
      args: Record<string, any>;
      preview: string;
      status: string;
    }> = [];
    let finalContent = '';
    let rounds = 0;

    for (let round = 0; round < maxRounds; round++) {
      rounds = round + 1;

      const aiResponse = await this.aiService.chat(messages, tools);

      // Sub-agents inherit the parent run's token budget via AsyncLocalStorage;
      // stop early when the shared pool is exhausted.
      const budget = currentRunBudget();
      budget?.consume(aiResponse.usage?.totalTokens || 0);
      if (budget?.exceeded) {
        finalContent = `Sub-agent ${task.taskName} stopped: the token budget limit (${budget.limit.toLocaleString('en-US')} tokens) was exceeded.`;
        break;
      }

      if (aiResponse.toolCalls.length === 0) {
        finalContent = aiResponse.content;
        break;
      }

      messages.push({
        role: 'assistant',
        content: aiResponse.content || null,
        tool_calls: aiResponse.toolCalls,
      });

      for (const toolCall of aiResponse.toolCalls) {
        const funcName = toolCall.function.name;
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        // Security: reject tool calls outside allowed scope
        if (
          task.allowedTools &&
          task.allowedTools.length > 0 &&
          !task.allowedTools.includes(funcName)
        ) {
          const blockedResult: ToolResult = {
            status: 'error',
            data: {},
            preview: `Tool "${funcName}" is not allowed for this sub-agent.`,
            metadata: {
              toolName: funcName,
              displayName: funcName,
              executionTime: 0,
            },
            error: {
              code: 'TOOL_NOT_ALLOWED',
              message: `Sub-agent "${task.taskName}" does not have access to the tool "${funcName}".`,
            },
          };

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(blockedResult),
          });

          toolOutputs.push({
            toolName: funcName,
            args,
            preview: blockedResult.preview,
            status: 'blocked',
          });

          continue;
        }

        onProgress?.({
          taskId: task.taskId,
          taskName: task.taskName,
          type: 'tool_start',
          data: { toolName: funcName, args },
        });

        // Execute with workspace isolation; failures return to the model verbatim.
        const result = await this.selfHealingService.executeWithIsolation(
          funcName,
          args,
          task.workspaceId,
        );

        onProgress?.({
          taskId: task.taskId,
          taskName: task.taskName,
          type: 'tool_done',
          data: {
            toolName: funcName,
            preview: result.preview,
            status: result.status,
          },
        });

        toolOutputs.push({
          toolName: funcName,
          args,
          preview: result.preview,
          status: result.status,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!finalContent) {
      finalContent = `Sub-agent "${task.taskName}" has completed its assigned task.`;
    }

    return { content: finalContent, toolOutputs, rounds };
  }

  /**
   * Build a focused system prompt for a sub-agent.
   *
   * OpenCode pattern: the parent agent specifies exactly what to return in
   * its prompt, and the sub-agent ends with a SINGLE final message that the
   * parent reads verbatim.
   */
  private buildSubAgentSystemPrompt(task: SubAgentTask): string {
    const parts = [
      'You are a Sub-Agent of Arunaki -- Desktop Computer Use Agent for Documents.',
      `Specific task to perform: "${task.taskName}".`,
      '',
      'Instructions:',
      '- Execute ONLY the requested task; do not perform unrelated actions.',
      '- Use available tools to complete the task.',
      '- End with a SINGLE final message containing exactly the information requested by the parent agent (results, totals, findings). Keep it concise.',
      '- The final message is returned to the parent agent verbatim; it is not shown to the user.',
      '- If the task cannot be completed, explain the blocker clearly in the final message.',
    ];

    if (task.additionalContext) {
      parts.push('', 'Additional Context:', task.additionalContext);
    }

    if (task.allowedTools && task.allowedTools.length > 0) {
      parts.push(
        '',
        `Allowed tools: ${task.allowedTools.join(', ')}`,
      );
    }

    return parts.join('\n');
  }
}
