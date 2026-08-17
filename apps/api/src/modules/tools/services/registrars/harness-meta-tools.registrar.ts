import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolAdapter } from '../tool-adapter.js';
import { AskUserTool } from '../ask-user.tool.js';
import { TodoStoreService } from '../todo-store.service.js';
import { WebSearchTool } from '../web-search.tool.js';
import { VisionAiTool } from '../vision-ai.tool.js';
import { ImageOcrTool } from '../image-ocr.tool.js';
import { DocSearchTool } from '../doc-search.tool.js';
import { KnowledgeBuilderTool } from '../knowledge-builder.tool.js';
import { SkillsTool } from '../skills.tool.js';
import { MemoryTool } from '../memory.tool.js';
import { WorkspaceToolsService } from '../workspace-tools.service.js';
import { PtcExecutorService } from '../ptc-executor.service.js';

@Injectable()
export class HarnessMetaToolsRegistrar {
  register(
    registry: ToolRegistryService,
    services: {
      askUser: AskUserTool;
      todoStore: TodoStoreService;
      webSearchTool: WebSearchTool;
      visionAiTool: VisionAiTool;
      imageOcrTool: ImageOcrTool;
      docSearchTool: DocSearchTool;
      knowledgeBuilderTool: KnowledgeBuilderTool;
      skillsTool: SkillsTool;
      memoryTool: MemoryTool;
      workspaceToolsService: WorkspaceToolsService;
      subAgentRunner?: any;
      ptcExecutor?: PtcExecutorService;
    },
  ) {
    registry.register(
      ToolAdapter.from({
        name: 'ask_user',
        displayName: 'Ask User',
        description: 'Requests clarification or missing details directly from the user.',
        tags: ['communication'],
        handler: async (args) => services.askUser.execute(args),
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Question to ask user' },
          },
          required: ['message'],
        },
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'todo_write',
        displayName: 'Write Todo',
        description: 'Updates task checklist for multi-step tasks.',
        tags: ['todo', 'plan', 'task', 'memory'],
        handler: (args) => {
          const runId = String(args.workspaceId || args.runId || 'default');
          const items = Array.isArray(args.todos) ? args.todos : [];
          services.todoStore.set(runId, items);
          return {
            status: 'success',
            data: { todos: services.todoStore.get(runId), runId },
            preview: `Todo list saved (${items.length} steps)`,
            metadata: { toolName: 'todo_write', displayName: 'Write Todo', executionTime: 0 },
          };
        },
        parameters: {
          type: 'object',
          properties: {
            todos: { type: 'array' },
          },
          required: ['todos'],
        },
        timeoutMs: 5000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'web_search',
        displayName: 'Search Web',
        description: 'Searches the web for up-to-date information.',
        tags: ['search', 'web', 'internet'],
        handler: (args) => services.webSearchTool.searchWeb(args.query),
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Web search query' },
          },
          required: ['query'],
        },
        timeoutMs: 15000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'agent_spawn',
        displayName: 'Spawn Sub-Agent',
        description: 'Spawns sub-agents for parallel sub-tasks.',
        tags: ['agent', 'subagent', 'parallel', 'spawn'],
        handler: async (args) => {
          if (!services.subAgentRunner) {
            return {
              status: 'error',
              data: {},
              preview: 'Sub-agent runner unavailable',
              metadata: { toolName: 'agent_spawn', displayName: 'Spawn Sub-Agent', executionTime: 0 },
            };
          }
          return services.subAgentRunner.spawnSubAgents({
            tasks: args.tasks,
            workspaceId: args.workspaceId,
            parentRunId: args.parentRunId,
          });
        },
        parameters: {
          type: 'object',
          properties: {
            tasks: { type: 'array' },
            workspaceId: { type: 'string' },
            parentRunId: { type: 'string' },
          },
          required: ['tasks'],
        },
        timeoutMs: 60000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'batch_execute',
        displayName: 'Programmatic Batch Execute',
        description:
          'Executes an atomic sequence of tools in one round-trip (e.g. read template + read data -> edit target file). If any step fails, all file modifications are automatically rolled back.',
        tags: ['batch', 'ptc', 'atomic', 'programmatic'],
        handler: async (args) => {
          if (!services.ptcExecutor) {
            return {
              status: 'error',
              error: {
                code: 'PTC_UNAVAILABLE',
                message: 'PTC executor is not available in current runtime.',
              },
              data: {},
              preview: 'PTC executor unavailable',
              metadata: {
                toolName: 'batch_execute',
                displayName: 'Programmatic Batch Execute',
                executionTime: 0,
              },
            };
          }
          const res = await services.ptcExecutor.executeBatch(
            args.workspaceId,
            args.workspaceRoot || '',
            args.operations || [],
            { atomic: args.atomic !== false },
          );
          return {
            status: res.status === 'success' ? 'success' : 'error',
            data: res,
            preview: res.message || `Executed ${res.completedSteps}/${res.totalSteps} batch operations.`,
            error: res.status !== 'success' ? { code: 'BATCH_ERROR', message: res.message || 'Batch failed' } : undefined,
            metadata: {
              toolName: 'batch_execute',
              displayName: 'Programmatic Batch Execute',
              executionTime: 0,
            },
          };
        },
        parameters: {
          type: 'object',
          properties: {
            operations: {
              type: 'array',
              description: 'Array of tool operations: [{ tool: "read", args: { filePath: "..." } }, { tool: "edit", args: { ... } }]',
              items: {
                type: 'object',
                properties: {
                  tool: { type: 'string' },
                  args: { type: 'object' },
                },
                required: ['tool', 'args'],
              },
            },
            atomic: {
              type: 'boolean',
              description: 'If true, rolls back all file modifications if any operation fails. Defaults to true.',
            },
          },
          required: ['operations'],
        },
        timeoutMs: 60000,
      }),
    );
  }
}
