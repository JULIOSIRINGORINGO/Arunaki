import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolAdapter } from '../tool-adapter.js';
import { AskUserTool } from '../ask-user.tool.js';
import { TodoStoreService } from '../todo-store.service.js';
import { WebSearchTool } from '../web-search.tool.js';
import { VisionAiTool } from '../vision-ai.tool.js';
import { ImageOcrTool } from '../image-ocr.tool.js';
import { DocSearchTool } from '../doc-search.tool.js';
import { MemoryTool } from '../memory.tool.js';
import { WorkspaceToolsService } from '../workspace-tools.service.js';
import { PtcExecutorService } from '../ptc-executor.service.js';
import { BrowserInteractionTool } from '../browser-interaction.tool.js';
import { StockLookupTool } from '../stock-lookup.tool.js';
import { IpGeolocationTool } from '../ip-geolocation.tool.js';
import { MultiDocOrchestratorService } from '../multi-doc-orchestrator.service.js';

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
      memoryTool: MemoryTool;
      workspaceToolsService: WorkspaceToolsService;
      browserInteractionTool?: BrowserInteractionTool;
      stockLookupTool?: StockLookupTool;
      ipGeolocationTool?: IpGeolocationTool;
      subAgentRunner?: any;
      ptcExecutor?: PtcExecutorService;
      multiDocOrchestrator?: MultiDocOrchestratorService;
    },
  ) {
    if (services.browserInteractionTool) {
      registry.register(services.browserInteractionTool);
    }
    if (services.stockLookupTool) {
      registry.register(services.stockLookupTool);
    }
    if (services.ipGeolocationTool) {
      registry.register(services.ipGeolocationTool);
    }
    if (services.imageOcrTool) {
      registry.register(
        ToolAdapter.from({
          name: 'image_ocr',
          displayName: 'Image OCR Parser',
          description:
            'Extracts text, numbers, tables, invoices, size recaps, and notes from image files (.png, .jpg, .jpeg, .webp, .bmp) using offline local OCR.',
          tags: ['image', 'ocr', 'vision', 'extract', 'read', 'photo', 'screenshot'],
          handler: async (args) => {
            // Resolve workspace-relative image paths to the absolute file —
            // OCR previously only checked cwd/uploads, never the workspace root.
            let fp = args.filePath;
            if (args.workspaceId && fp && !/^(https?:|data:)/i.test(fp)) {
              try {
                const resolved =
                  await services.workspaceToolsService.resolveWithinWorkspace(
                    args.workspaceId,
                    String(fp).replace(/^@/, '').trim(),
                  );
                if (resolved) fp = resolved;
              } catch {
                /* keep original path; the tool reports a precise error */
              }
            }
            return services.imageOcrTool.recognizeText(fp, args.language);
          },
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Relative or absolute path to the image file (e.g. @pasted_image_...png or document screenshot)',
              },
              language: {
                type: 'string',
                description: 'OCR language model (e.g. eng, ind, or eng+ind). Defaults to eng.',
              },
            },
            required: ['filePath'],
          },
          timeoutMs: 30000,
        }),
      );
    }
    if (services.visionAiTool) {
      registry.register(
        ToolAdapter.from({
          name: 'vision_ai',
          displayName: 'Vision AI & Image Analysis',
          description:
            'Analyzes image content, receipts, handwritten notes, tables, charts, or screenshots to extract structured text and numbers.',
          tags: ['image', 'vision', 'ocr', 'analyze', 'screenshot'],
          handler: async (args) => {
            let src = args.imageSource;
            if (
              args.workspaceId &&
              src &&
              !/^(https?:|data:)/i.test(src) &&
              !/^[A-Za-z0-9+/]{40,}={0,2}$/.test(String(src).trim())
            ) {
              try {
                const resolved =
                  await services.workspaceToolsService.resolveWithinWorkspace(
                    args.workspaceId,
                    String(src).replace(/^@/, '').trim(),
                  );
                if (resolved) src = resolved;
              } catch {
                /* keep original; the tool reports a precise error */
              }
            }
            return services.visionAiTool.analyzeImage(src, args.prompt);
          },
          parameters: {
            type: 'object',
            properties: {
              imageSource: {
                type: 'string',
                description: 'File path, base64 data, or image URL to analyze',
              },
              prompt: {
                type: 'string',
                description: 'Specific extraction instructions for the image',
              },
            },
            required: ['imageSource'],
          },
          timeoutMs: 30000,
        }),
      );
    }
    registry.register(
      ToolAdapter.from({
        name: 'doc_search',
        displayName: 'Document Search (Indexed)',
        description:
          'Searches indexed workspace documents, knowledge entries, and chat messages in the database for a query. Complements search_workspace (disk scan).',
        tags: ['search', 'document', 'database', 'knowledge'],
        handler: async (args) =>
          services.docSearchTool.searchDocuments(args.query, args.limit),
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keywords' },
            limit: {
              type: 'number',
              description: 'Max results per source (default 5)',
            },
          },
          required: ['query'],
        },
        timeoutMs: 20000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'memory',
        displayName: 'Persistent Memory',
        description:
          'Stores and retrieves persistent business facts across sessions. Use remember to save a fact with a stable key; use recall/search to retrieve it later.',
        tags: ['memory', 'remember', 'recall', 'persist'],
        handler: async (args) => {
          const workspaceId = args.workspaceId;
          switch (args.action) {
            case 'remember':
              return services.memoryTool.remember({
                type: String(args.type || 'fact'),
                key: String(args.key || ''),
                content: String(args.content || ''),
                workspaceId,
              });
            case 'recall':
              return services.memoryTool.recall(
                String(args.type || ''),
                String(args.key || ''),
              );
            case 'search':
              return services.memoryTool.searchMemories(
                String(args.query || ''),
                workspaceId,
              );
            default:
              return services.memoryTool.listMemories({
                workspaceId,
              });
          }
        },
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['remember', 'recall', 'search', 'list'],
              description: 'Memory operation (defaults to list)',
            },
            type: {
              type: 'string',
              description: "Memory type, e.g. 'preference' or 'fact'",
            },
            key: {
              type: 'string',
              description: 'Stable unique key, e.g. pelanggan:budi',
            },
            content: {
              type: 'string',
              description: 'Fact content to store (remember only)',
            },
            query: {
              type: 'string',
              description: 'Keyword query (search only)',
            },
            limit: { type: 'number', description: 'Max rows returned' },
          },
          required: [],
        },
        timeoutMs: 15000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'ask_user',
        displayName: 'Ask User',
        description:
          'Requests clarification or missing details directly from the user. Call this TOOL (instead of writing your question as plain text) whenever the user asked you to confirm/ask something first, or a required parameter is genuinely missing.',
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
            metadata: {
              toolName: 'todo_write',
              displayName: 'Write Todo',
              executionTime: 0,
            },
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
        description:
          'Searches the public web for real-time information, product catalogs, colors, specifications, prices, external facts, and documentation. Use this when the user asks about products, brands, or information not found in local workspace files.',
        tags: ['search', 'web', 'internet', 'products', 'prices', 'colors', 'specs'],
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
              metadata: {
                toolName: 'agent_spawn',
                displayName: 'Spawn Sub-Agent',
                executionTime: 0,
              },
            };
          }
          // Normalize model-supplied tasks to SubAgentTask shape
          const rawTasks = Array.isArray(args.tasks) ? args.tasks : [];
          const normalizedTasks = rawTasks.map((t: any, i: number) => ({
            taskId: String(t?.taskId ?? `sub-${Date.now()}-${i}`),
            taskName: String(t?.taskName ?? t?.name ?? `Sub-task ${i + 1}`),
            taskDescription: String(
              t?.taskDescription ??
                t?.description ??
                t?.instruction ??
                (typeof t === 'string' ? t : ''),
            ),
            allowedTools: Array.isArray(t?.allowedTools)
              ? t.allowedTools
              : undefined,
            maxRounds: Number(t?.maxRounds) > 0 ? Number(t.maxRounds) : 5,
            workspaceId: args.workspaceId,
          }));
          const results = await services.subAgentRunner.spawnParallel(
            normalizedTasks,
          );
          return {
            status:
              Array.isArray(results) && results.every((r) => r.status === 'success')
                ? 'success'
                : 'error',
            data: { results },
            preview: Array.isArray(results)
              ? `${results.filter((r) => r.status === 'success').length}/${results.length} sub-agents completed`
              : 'No sub-agent results',
            metadata: {
              toolName: 'agent_spawn',
              displayName: 'Spawn Sub-Agent',
              executionTime: 0,
            },
          };
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
          'PREFERRED tool for any multi-step file operation (read template + read data -> edit target, copy content between files, apply several edits at once). Executes an atomic sequence of tools in ONE round-trip via operations:[{tool,args},...]. If any step fails, all file modifications roll back automatically.',
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
            preview:
              res.message ||
              `Executed ${res.completedSteps}/${res.totalSteps} batch operations.`,
            error:
              res.status !== 'success'
                ? {
                    code: 'BATCH_ERROR',
                    message: res.message || 'Batch failed',
                  }
                : undefined,
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
              description:
                'Array of tool operations: [{ tool: "read", args: { filePath: "..." } }, { tool: "edit", args: { ... } }]',
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
              description:
                'If true, rolls back all file modifications if any operation fails. Defaults to true.',
            },
          },
          required: ['operations'],
        },
        timeoutMs: 60000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'multi_doc_process',
        displayName: 'Parallel Multi-Document Process',
        description:
          'Processes multiple documents in parallel using sandboxed sub-agents without overflowing chat context.',
        tags: ['parallel', 'subagent', 'documents', 'batch'],
        handler: async (args) => {
          if (!services.multiDocOrchestrator) {
            return {
              status: 'error',
              error: {
                code: 'ORCHESTRATOR_UNAVAILABLE',
                message: 'Multi-document orchestrator is not available.',
              },
              data: {},
              preview: 'Multi-doc orchestrator unavailable',
              metadata: {
                toolName: 'multi_doc_process',
                displayName: 'Parallel Multi-Document Process',
                executionTime: 0,
              },
            };
          }
          const res =
            await services.multiDocOrchestrator.processDocumentsParallel({
              workspaceId: args.workspaceId,
              files: args.files || [],
              instruction: args.instruction || '',
              maxConcurrency: args.maxConcurrency || 3,
            });
          return {
            status: res.failedCount === 0 ? 'success' : 'error',
            data: res,
            preview: `Processed ${res.successCount}/${res.totalFiles} documents in parallel (${res.totalDurationMs}ms).`,
            metadata: {
              toolName: 'multi_doc_process',
              displayName: 'Parallel Multi-Document Process',
              executionTime: res.totalDurationMs,
            },
          };
        },
        parameters: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description:
                'List of relative file paths to process concurrently.',
            },
            instruction: {
              type: 'string',
              description:
                'The task instruction / extraction goal for each document.',
            },
            maxConcurrency: {
              type: 'number',
              description: 'Maximum number of parallel workers (default: 3).',
            },
          },
          required: ['files', 'instruction'],
        },
        timeoutMs: 120000,
      }),
    );
  }
}
