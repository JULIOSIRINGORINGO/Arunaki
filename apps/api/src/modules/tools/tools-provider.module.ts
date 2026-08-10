import { Module, OnModuleInit, Inject, Optional, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SearchModule } from '../search/search.module.js';
import { FileModule } from '../file/file.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolAdapter } from './services/tool-adapter.js';
import { AskUserTool } from './services/ask-user.tool.js';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { EnterpriseCalculatorTool } from './services/enterprise-calculator.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';
import { DocumentReaderTool } from './services/document-reader.tool.js';
import { DataQueryTool } from './services/data-query.tool.js';
import { ImageOcrTool } from './services/image-ocr.tool.js';
import { DocSearchTool } from './services/doc-search.tool.js';
import { KnowledgeBuilderTool } from './services/knowledge-builder.tool.js';
import { KnowledgeSearchTool } from './services/knowledge-search.tool.js';
import { WebSearchTool } from './services/web-search.tool.js';
import { VisionAiTool } from './services/vision-ai.tool.js';
import { UnitConverterTool } from './services/unit-converter.tool.js';
import { DraftCommunicationTool } from './services/draft-communication.tool.js';
import { WorkspaceToolsService } from './services/workspace-tools.service.js';
import { SkillsTool } from './services/skills.tool.js';
import { MemoryTool } from './services/memory.tool.js';
import { BrowserInteractionService } from '../interaction/browser-interaction.service.js';
import { DesktopBridgeService } from '../interaction/desktop-bridge.service.js';
import { DocumentReconciliationService } from '../document/doc-reconciliation.service.js';
import { CronService } from '../cron/cron.service.js';
import { CronModule } from '../cron/cron.module.js';
import { ProgrammaticVerifierService } from './services/programmatic-verifier.service.js';
import { TodoStoreService } from './services/todo-store.service.js';
import { SubAgentRunnerService } from '../chat/sub-agent-runner.service.js';
import { ContextModule } from '../ai/context/context.module.js';
import { ContextQuarantine } from '../ai/context/context-quarantine.service.js';

import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    KnowledgeModule,
    StorageModule,
    SearchModule,
    FileModule,
    SkillsModule,
    MemoryModule,
    forwardRef(() => AiModule),
    forwardRef(() => CronModule),
  ],
  providers: [
    ToolRegistryService,
    AskUserTool,
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeBuilderTool,
    KnowledgeSearchTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
    SkillsTool,
    MemoryTool,
    DocumentReconciliationService,
    ProgrammaticVerifierService,
    TodoStoreService,
  ],
  exports: [
    ToolRegistryService,
    AskUserTool,
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeBuilderTool,
    KnowledgeSearchTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
    SkillsTool,
    MemoryTool,
    DocumentReconciliationService,
    ProgrammaticVerifierService,
    TodoStoreService,
  ],
})
export class ToolsProviderModule implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => ToolRegistryService)) private readonly registry: ToolRegistryService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(forwardRef(() => ContextQuarantine)) private readonly contextQuarantine: ContextQuarantine,
    @Optional() @Inject(forwardRef(() => CronService)) private readonly cronService?: CronService,
  ) {}

  private get textExtractorTool() { return this.moduleRef.get(TextExtractorTool, { strict: false }); }
  private get calculatorTool() { return this.moduleRef.get(EnterpriseCalculatorTool, { strict: false }); }
  private get documentGeneratorTool() { return this.moduleRef.get(DocumentGeneratorTool, { strict: false }); }
  private get documentReaderTool() { return this.moduleRef.get(DocumentReaderTool, { strict: false }); }
  private get askUser() { return this.moduleRef.get(AskUserTool, { strict: false }); }
  private get dataQueryTool() { return this.moduleRef.get(DataQueryTool, { strict: false }); }
  private get imageOcrTool() { return this.moduleRef.get(ImageOcrTool, { strict: false }); }
  private get docSearchTool() { return this.moduleRef.get(DocSearchTool, { strict: false }); }
  private get knowledgeBuilderTool() { return this.moduleRef.get(KnowledgeBuilderTool, { strict: false }); }
  private get webSearchTool() { return this.moduleRef.get(WebSearchTool, { strict: false }); }
  private get visionAiTool() { return this.moduleRef.get(VisionAiTool, { strict: false }); }
  private get unitConverterTool() { return this.moduleRef.get(UnitConverterTool, { strict: false }); }
  private get draftCommunicationTool() { return this.moduleRef.get(DraftCommunicationTool, { strict: false }); }
  private get workspaceToolsService() { return this.moduleRef.get(WorkspaceToolsService, { strict: false }); }
  private get skillsTool() { return this.moduleRef.get(SkillsTool, { strict: false }); }
  private get memoryTool() { return this.moduleRef.get(MemoryTool, { strict: false }); }
  private get subAgentRunner() { return this.moduleRef.get(SubAgentRunnerService, { strict: false }); }
  private get browserInteraction() { return this.moduleRef.get(BrowserInteractionService, { strict: false }); }
  private get desktopBridge() { return this.moduleRef.get(DesktopBridgeService, { strict: false }); }
  private get docReconciliationService() { return this.moduleRef.get(DocumentReconciliationService, { strict: false }); }
  private get todoStore() { return this.moduleRef.get(TodoStoreService, { strict: false }); }

  onModuleInit() {
    this.registerTools();
  }

  private registerTools() {
    this.registry.register(
      ToolAdapter.from({
        name: 'ask_user',
        displayName: 'Ask User',
        description: 'Use this tool when you need additional data or clarification from the user. If the user asks to create or update a report but did not provide the numbers or data, you MUST call this tool to ask for the missing details.',
        tags: ['communication'],
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message or question to present to the user requesting missing information.',
            },
          },
          required: ['message'],
        },
        handler: async (args) => this.askUser.execute(args),
      })
    );

    // ─── Todo / Plan (working memory for long tasks) ───────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'todo_write',
        displayName: 'Write Todo',
        description:
          'Write or update the task checklist (todo list) for multi-step tasks (>3 steps). Update step statuses as each step completes.',
        tags: ['todo', 'plan', 'task', 'memory'],
        handler: (args) => {
          const runId = String(args.workspaceId || args.runId || 'default');
          const items = Array.isArray(args.todos) ? args.todos : [];
          this.todoStore.set(runId, items);
          return {
            status: 'success',
            data: { todos: this.todoStore.get(runId), runId },
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
            todos: {
              type: 'array',
              description: 'Full list of task steps (full state, not delta)',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique step ID' },
                  content: { type: 'string', description: 'Step description' },
                  status: {
                    type: 'string',
                    enum: ['pending', 'in_progress', 'completed'],
                  },
                },
                required: ['id', 'content', 'status'],
              },
            },
          },
          required: ['todos'],
        },

        timeoutMs: 5000,
      }),
    );

    // ─── Data & Documents ───────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'extract_structured_data',
        displayName: 'Extract Data',
        description:
          'Validates and normalizes structured data from documents. Send already-extracted data, not raw text.',
        tags: ['extract', 'data', 'validate'],
        handler: (args) =>
          this.textExtractorTool.extractStructuredData({
            documentType: args.documentType,
            title: args.title,
            items: args.items,
            totals: args.totals,
            metadata: args.metadata,
          }),
        parameters: {
          type: 'object',
          properties: {
            documentType: { type: 'string', description: 'Document type' },
            title: { type: 'string', description: 'Title or source name' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  qty: { type: 'number' },
                  unitPrice: { type: 'number' },
                  total: { type: 'number' },
                  unit: { type: 'string' },
                },
              },
            },
            totals: {
              type: 'object',
              properties: {
                subtotal: { type: 'number' },
                tax: { type: 'number' },
                total: { type: 'number' },
              },
            },
            metadata: { type: 'object' },
          },
          required: ['items'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'document_reader',
        displayName: 'Read Document',
        description: 'Reads document files and extracts their raw text.',
        tags: [
          'read',
          'document',
          'file',
          'pdf',
          'docx',
          'excel',
          'csv',
          'text',
        ],
        handler: async (args) => {
          try {
            const safePath = await this.workspaceToolsService.resolveWithinWorkspace(
              args.workspaceId,
              args.filePath,
            );
            return await this.documentReaderTool.readDocument(safePath);
          } catch (err) {
            return {
              status: 'error',
              data: {},
              preview: `Access denied: ${err.message}`,
              metadata: {
                toolName: 'document_reader',
                displayName: 'Read Document',
                executionTime: 0,
              },
              error: {
                code: 'WORKSPACE_ISOLATION_VIOLATION',
                message: err.message,
              },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID containing documents',
            },
            filePath: {
              type: 'string',
              description:
                'File path inside workspace (absolute or relative)',
            },
          },
          required: ['workspaceId', 'filePath'],
        },
        timeoutMs: 10000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'data_query',
        displayName: 'Query Database',
        description: 'Real-time database query. SELECT queries only.',
        tags: ['database', 'query', 'sql', 'realtime'],
        handler: async (args) => {
          if (args.action === 'list_tables')
            return this.dataQueryTool.listTables();
          if (args.action === 'describe_table' && args.tableName)
            return this.dataQueryTool.describeTable(args.tableName);
          return this.dataQueryTool.queryData(args.sql || '');
        },
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['query', 'list_tables', 'describe_table'],
              description:
                'Action: query (run SQL), list_tables, describe_table',
            },
            sql: { type: 'string', description: 'SQL SELECT query' },
            tableName: {
              type: 'string',
              description: 'Table name (for describe_table)',
            },
          },
          required: ['action'],
        },
        timeoutMs: 10000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'image_ocr',
        displayName: 'Image OCR',
        description: 'Reads text from images using OCR.',
        tags: ['image', 'ocr', 'text', 'recognition'],
        handler: async (args) => {
          try {
            const safePath = await this.workspaceToolsService.resolveWithinWorkspace(
              args.workspaceId,
              args.filePath,
            );
            return await this.imageOcrTool.recognizeText(safePath, args.language);
          } catch (err) {
            return {
              status: 'error',
              data: {},
              preview: `Access denied: ${err.message}`,
              metadata: {
                toolName: 'image_ocr',
                displayName: 'Image OCR',
                executionTime: 0,
              },
              error: {
                code: 'WORKSPACE_ISOLATION_VIOLATION',
                message: err.message,
              },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID containing images',
            },
            filePath: {
              type: 'string',
              description: 'Image file path inside workspace (absolute or relative)',
            },
            language: {
              type: 'string',
              description: 'OCR language (default: eng)',
            },
          },
          required: ['workspaceId', 'filePath'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 30000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'doc_search',
        displayName: 'Search Documents',
        description:
          'Searches documents, knowledge, and messages by keyword.',
        tags: ['search', 'document', 'knowledge', 'find'],
        handler: (args) =>
          this.docSearchTool.searchDocuments(args.query, args.limit),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            query: { type: 'string', description: 'Search keyword' },
            limit: { type: 'number', description: 'Result limit (default: 10)' },
          },
          required: ['workspaceId', 'query'],
        },
        timeoutMs: 10000,
        cacheable: true,
      }),
    );

    // ─── Calculation & Export ───────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'calculate',
        displayName: 'Calculate Financials',
        description:
          'Performs numeric calculations — subtotal, tax, discount, total, or any math operation.',
        tags: ['calculate', 'math', 'finance', 'tax', 'discount', 'total'],
        handler: (args) =>
          this.calculatorTool.calculateFinancials(
            args.items || [],
            args.taxPercent || 0,
            args.discountPercent || 0,
          ),
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  qty: { type: 'number' },
                  price: { type: 'number' },
                },
              },
            },
            taxPercent: { type: 'number' },
            discountPercent: { type: 'number' },
          },
          required: ['items'],
        },
        outputType: 'calculation',
        timeoutMs: 3000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'generate_export',
        displayName: 'Export Document',
        description:
          'Converts structured data into ready-to-download files — Excel (xlsx), CSV, PDF, Word (docx), or PowerPoint (pptx).',
        tags: [
          'export',
          'document',
          'pdf',
          'docx',
          'pptx',
          'xlsx',
          'csv',
          'spreadsheet',
          'presentation',
          'invoice',
          'report',
        ],
        handler: (args) => this.handleGenerateExport(args),
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['xlsx', 'csv', 'pdf', 'docx', 'pptx'],
              description: 'Output file format',
            },
            title: { type: 'string', description: 'Document title' },
            content: {
              type: 'string',
              description:
                'Document content in text/markdown form (for pdf, docx)',
            },
            sheetName: {
              type: 'string',
              description: 'Sheet name (for xlsx/csv)',
            },
            rows: { type: 'array', items: { type: 'object' }, description: 'Row data (for xlsx/csv)' },
            slides: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  heading: { type: 'string' },
                  content: { type: 'string' },
                },
              },
              description: 'Slide data (for pptx)',
            },
            filename: { type: 'string', description: 'Output file name' },
          },
          required: ['format'],
        },
        outputType: 'document',
        estimatedLatency: 'medium',
        timeoutMs: 15000,
      }),
    );

    // ─── Knowledge ──────────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'save_knowledge',
        displayName: 'Save Knowledge',
        description:
          'Saves or updates the Knowledge Base. Use when the user wants to create or update knowledge.',
        tags: ['knowledge', 'save', 'create', 'update', 'base'],
        handler: (args) =>
          this.knowledgeBuilderTool.saveKnowledge(
            args.title,
            args.content,
            args.type,
          ),
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Knowledge title (business/company name)',
            },
            content: {
              type: 'string',
              description: 'Knowledge content in markdown format',
            },
            type: {
              type: 'string',
              description: 'Knowledge type based on business domain',
            },
          },
          required: ['title', 'content'],
        },
        timeoutMs: 5000,
      }),
    );

    // ─── Web & Vision ───────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'web_search',
        displayName: 'Web Search',
        description:
          'Searches the internet for real-time information (material prices, market news, exchange rates, competitors, etc.).',
        tags: ['search', 'web', 'internet', 'realtime', 'google', 'tavily'],
        handler: (args) =>
          this.webSearchTool.searchWeb(args.query, args.searchDepth),
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Keyword or question to search for on the internet',
            },
            searchDepth: {
              type: 'string',
              enum: ['basic', 'advanced'],
              description:
                'Search depth: basic (fast) or advanced (deep)',
            },
          },
          required: ['query'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'vision_ai',
        displayName: 'Vision AI',
        description:
          'Analyzes images/photos (shopping receipts, crumpled notes, invoices, handwriting, product images) using Vision AI.',
        tags: ['vision', 'ocr', 'image', 'receipt', 'nota', 'foto', 'struk'],
        handler: (args) =>
          this.visionAiTool.analyzeImage(args.imageSource, args.prompt),
        parameters: {
          type: 'object',
          properties: {
            imageSource: {
              type: 'string',
              description: 'Local image file path or image URL',
            },
            prompt: {
              type: 'string',
              description:
                'Specific instructions on what to extract from the image',
            },
          },
          required: ['imageSource'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 25000,
      }),
    );

    // ─── Conversion & Communication ─────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'unit_converter',
        displayName: 'Convert Units',
        description:
          'Converts values between various units (yard, meter, cm, roll, kg, gram, dozen, kodi) or currencies (usd, idr, eur, sgd).',
        tags: ['converter', 'unit', 'currency', 'domain-config'],
        handler: (args) =>
          this.unitConverterTool.convert({
            value: Number(args.value),
            from: args.from,
            to: args.to,
            domain: args.domain,
          }),
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'number',
              description: 'Value to convert',
            },
            from: { type: 'string', description: 'Source unit' },
            to: { type: 'string', description: 'Target unit' },
            domain: {
              type: 'string',
              description: 'Business type for specific units',
            },
          },
          required: ['value', 'from', 'to'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'draft_communication',
        displayName: 'Draft Communication',
        description:
          'Creates professional message drafts for WhatsApp, formal Email, Price Quote (Quotation), or Invoice Reminder.',
        tags: [
          'draft',
          'whatsapp',
          'email',
          'quotation',
          'invoice',
          'communication',
        ],
        handler: (args) =>
          this.draftCommunicationTool.draft({
            type: args.type,
            recipientName: args.recipientName,
            topic: args.topic,
            keyPoints: args.keyPoints,
          }),
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['whatsapp', 'email', 'quotation', 'invoice_reminder'],
              description: 'Type of communication draft',
            },
            recipientName: {
              type: 'string',
              description: 'Recipient / client name',
            },
            topic: { type: 'string', description: 'Message topic or subject' },
            keyPoints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Key points to convey',
            },
          },
          required: ['type', 'recipientName', 'topic'],
        },
        timeoutMs: 5000,
      }),
    );

    // ─── Workspace ──────────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'search_workspace',
        displayName: 'Search Workspace',
        description:
          'Searches for keywords, topics, or data across all documents in the active Workspace.',
        tags: ['search', 'fts', 'workspace', 'query', 'files'],
        handler: (args) =>
          this.workspaceToolsService.searchWorkspace(
            args.workspaceId,
            args.query,
          ),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            query: { type: 'string', description: 'Search keyword' },
          },
          required: ['workspaceId', 'query'],
        },
        timeoutMs: 8000,
        cacheable: true,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'list',
        displayName: 'List Files',
        description: 'Lists all files in the workspace.',
        tags: ['files', 'list', 'workspace', 'directory'],
        handler: (args) =>
          this.workspaceToolsService.listWorkspaceFiles(args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
        },
        timeoutMs: 5000,
        cacheable: true,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'read',
        displayName: 'Read File',
        description: 'Reads content from a file in the workspace.',
        tags: ['read', 'pdf', 'docx', 'xlsx', 'csv', 'workspace'],
        handler: (args) =>
          this.workspaceToolsService.readWorkspaceFile(
            args.filePath,
            args.workspaceId,
          ),
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'File name or path',
            },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['workspaceId', 'filePath'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 15000,
        cacheable: true,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'write',
        mutating: true,
        displayName: 'Create File',
        description: 'Writes full content to a file in the workspace.',
        tags: ['write', 'create', 'export', 'workspace', 'file'],
        handler: (args) =>
          this.workspaceToolsService.writeWorkspaceFile({
            workspaceId: args.workspaceId,
            filename: args.filename,
            format: args.format,
            content: args.content,
            rows: args.rows,
            title: args.title,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            filename: {
              type: 'string',
              description: 'File name',
            },
            format: {
              type: 'string',
              enum: ['xlsx', 'csv', 'pdf', 'docx', 'txt', 'md', 'json'],
              description: 'Document format',
            },
            content: { type: 'string', description: 'File content' },
            rows: { type: 'array', items: { type: 'object' }, description: 'Data rows for table files' },
            title: { type: 'string', description: 'Document title' },
          },
          required: ['workspaceId', 'filename', 'format'],
        },
        outputType: 'document',
        estimatedLatency: 'slow',
        timeoutMs: 60000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'delete',
        mutating: true,
        displayName: 'Delete File',
        description: 'Deletes a file from the workspace.',
        tags: ['delete', 'remove', 'trash', 'workspace', 'file'],
        handler: (args) =>
          this.workspaceToolsService.deleteWorkspaceFile({
            workspaceId: args.workspaceId,
            filename: args.filename,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            filename: {
              type: 'string',
              description: 'File name to delete',
            },
          },
          required: ['workspaceId', 'filename'],
        },
        estimatedLatency: 'fast',
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'rename',
        mutating: true,
        displayName: 'Rename File',
        description: 'Renames a file in the workspace.',
        tags: ['rename', 'move', 'workspace', 'file'],
        handler: (args) =>
          this.workspaceToolsService.renameWorkspaceFile({
            workspaceId: args.workspaceId,
            filename: args.filename,
            newFilename: args.newFilename,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID (required)' },
            filename: {
              type: 'string',
              description: 'Current file name',
            },
            newFilename: {
              type: 'string',
              description: 'New file name',
            },
          },
          required: ['workspaceId', 'filename', 'newFilename'],
        },
        estimatedLatency: 'fast',
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'edit',
        mutating: true,
        displayName: 'Edit File',
        description: 'Edits a file in the workspace with updated content or instructions.',
        tags: ['edit', 'update', 'workspace', 'file'],
        handler: (args) =>
          this.workspaceToolsService.editWorkspaceFile({
            workspaceId: args.workspaceId,
            filename: args.filename,
            instructions: args.instructions,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID (required)' },
            filename: {
              type: 'string',
              description: 'Existing file name to edit (e.g. laporan.txt)',
            },
            instructions: {
              type: 'string',
              description: 'What to change in the file (e.g. update today date, add these transactions, recalc totals)',
            },
          },
          required: ['filename', 'instructions'],
        },
        estimatedLatency: 'slow',
        timeoutMs: 120000,
      }),
    );

    // ─── Skills ─────────────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'list_skills',
        displayName: 'List Skills',
        description:
          'Lists all stored workflow skills. A skill is a reusable workflow template.',
        tags: ['skills', 'list', 'workflow', 'template'],
        handler: () => this.skillsTool.listSkills(),
        parameters: { type: 'object', properties: {} },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'view_skill',
        displayName: 'View Skill',
        description:
          'Views workflow skill details — including the full instructions to follow.',
        tags: ['skills', 'view', 'workflow', 'template'],
        handler: (args) => this.skillsTool.viewSkill(args.name),
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name (snake_case)' },
          },
          required: ['name', 'workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'create_skill',
        mutating: true,
        displayName: 'Create Skill',
        description: 'Saves a successful workflow as a new skill.',
        tags: ['skills', 'create', 'workflow', 'template', 'save'],
        handler: (args) =>
          this.skillsTool.createSkill({
            name: args.name,
            displayName: args.displayName,
            description: args.description,
            category: args.category,
            content: args.content,
            tags: args.tags,
            workspaceId: args.workspaceId,
          }),
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Skill name in snake_case',
            },
            displayName: { type: 'string', description: 'Skill display name' },
            description: {
              type: 'string',
              description: 'Short skill description',
            },
            category: {
              type: 'string',
              enum: ['general', 'data-processing', 'reporting', 'integration'],
              description: 'Skill category',
            },
            content: {
              type: 'string',
              description: 'Full skill instructions in markdown format',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for searching',
            },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['name', 'displayName', 'description', 'content', 'workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'search_skills',
        displayName: 'Search Skills',
        description: 'Searches for skills by keyword.',
        tags: ['skills', 'search', 'find', 'workflow'],
        handler: (args) => this.skillsTool.searchSkills(args.query),
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keyword' },
          },
          required: ['query'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'update_skill',
        mutating: true,
        displayName: 'Update Skill',
        description:
          'Updates an existing skill (content, description, tags). Version is incremented automatically.',
        tags: ['skills', 'update', 'edit', 'workflow'],
        handler: (args) =>
          this.skillsTool.updateSkill(args.name, args.workspaceId, {
            displayName: args.displayName,
            description: args.description,
            content: args.content,
            tags: args.tags,
          }),
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the skill to update',
            },
            displayName: { type: 'string', description: 'New display name' },
            description: { type: 'string', description: 'New description' },
            content: { type: 'string', description: 'New markdown content' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'New tags',
            },
          },
          required: ['name', 'workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'delete_skill',
        mutating: true,
        displayName: 'Delete Skill',
        description:
          'Deactivates a skill (soft delete). The skill no longer appears in the list but still exists in the database.',
        tags: ['skills', 'delete', 'remove', 'workflow'],
        handler: (args) => this.skillsTool.deleteSkill(args.name, args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the skill to deactivate',
            },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['name', 'workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    // ─── Memory ─────────────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'list_memories',
        displayName: 'List Memories',
        description:
          'Lists all stored memories (preferences, context, history).',
        tags: ['memory', 'list', 'context', 'preferences'],
        handler: (args) => this.memoryTool.listMemories(args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'save_memory',
        mutating: true,
        displayName: 'Save Memory',
        description: 'Saves important information as cross-session memory.',
        tags: ['memory', 'save', 'remember', 'preference', 'context', 'domain'],
        handler: (args) =>
          this.memoryTool.saveMemory({
            type: args.type,
            key: args.key,
            content: args.content,
            importance: args.importance,
            domain: args.domain,
            workspaceId: args.workspaceId,
          }),
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'preference',
                'business_fact',
                'correction',
                'workspace_history',
                'context',
                'interaction',
              ],
              description: 'Memory type',
            },
            key: { type: 'string', description: 'Unique memory key' },
            content: { type: 'string', description: 'Memory content' },
            importance: {
              type: 'number',
              description: 'Importance level 1-10',
            },
            domain: { type: 'string', description: 'Business domain' },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['type', 'key', 'content', 'workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'search_memories',
        displayName: 'Search Memories',
        description: 'Searches for memories by keyword.',
        tags: ['memory', 'search', 'find', 'recall'],
        handler: (args) => this.memoryTool.searchMemories(args.query, args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keyword' },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['query', 'workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'delete_memory',
        mutating: true,
        displayName: 'Delete Memory',
        description: 'Deletes a memory by type and key.',
        tags: ['memory', 'delete', 'remove'],
        handler: (args) => this.memoryTool.deleteMemory(args.type, args.key, args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Memory type' },
            key: { type: 'string', description: 'Memory key' },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['type', 'key', 'workspaceId'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'search_sessions',
        displayName: 'Search Sessions',
        description:
          'Search across all past conversations for relevant context (FTS5 full-text search).',
        tags: ['memory', 'search', 'recall', 'sessions', 'history'],
        handler: (args) =>
          this.memoryTool.searchSessions(args.query, args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (keywords or phrases)',
            },
            workspaceId: {
              type: 'string',
              description: 'Optional workspace ID to limit search scope',
            },
          },
          required: ['query'],
        },
        timeoutMs: 5000,
      }),
    );

    // ─── Browser Interaction ───────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'browser_navigate',
        displayName: 'Browser Navigate',
        description:
          'Opens a web page (Google Docs, Google Sheets, website) in the visible browser. ' +
          'Use to open online documents or search for information on the web.',
        tags: ['browser', 'navigate', 'web', 'google-docs', 'google-sheets'],
        handler: async (args) => {
          try {
            const r = await this.browserInteraction.navigate(args.url, args.workspaceId);
            return {
              status: 'success' as const,
              data: { title: r.title, url: r.url },
              preview: `Opened page: ${r.title}`,
              metadata: { toolName: 'browser_navigate', displayName: 'Browser Navigate', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_navigate', displayName: 'Browser Navigate', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL of the web page to open (https://...)' },
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
          required: ['url'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 35000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_click',
        displayName: 'Browser Click',
        description:
          'Clicks an element on the web page using a CSS selector. ' +
          'Use to click buttons, links, menus, or cells in Google Docs/Sheets.',
        tags: ['browser', 'click', 'interact'],
        handler: async (args) => {
          try {
            await this.browserInteraction.click(args.selector, args.workspaceId);
            return {
              status: 'success' as const,
              data: { selector: args.selector },
              preview: `Clicked: ${args.selector}`,
              metadata: { toolName: 'browser_click', displayName: 'Browser Click', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_click', displayName: 'Browser Click', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the element to click (e.g. "#id", ".class", "button")',
            },
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
          required: ['selector'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_type',
        displayName: 'Browser Type',
        description:
          'Types text into a form field, spreadsheet cell, or document editor. ' +
          'Use to fill data in Google Sheets, type in Google Docs, or fill forms.',
        tags: ['browser', 'type', 'input', 'form'],
        handler: async (args) => {
          try {
            if (args.slowly) {
              await this.browserInteraction.typeSlowly(args.selector, args.text, 50, args.workspaceId);
            } else {
              await this.browserInteraction.type(args.selector, args.text, args.workspaceId);
            }
            return {
              status: 'success' as const,
              data: { selector: args.selector, length: args.text.length },
              preview: `Typed ${args.text.length} characters in: ${args.selector}`,
              metadata: { toolName: 'browser_type', displayName: 'Browser Type', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_type', displayName: 'Browser Type', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the element to fill with text',
            },
            text: { type: 'string', description: 'Text to type' },
            slowly: {
              type: 'boolean',
              description: 'Type slowly, character by character (default: false)',
            },
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
          required: ['selector', 'text'],
        },
        timeoutMs: 30000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_screenshot',
        displayName: 'Browser Screenshot',
        description:
          'Takes a screenshot of the current web page. The image is returned as base64. ' +
          'Use to see what is currently displayed in the browser and diagnose problems.',
        tags: ['browser', 'screenshot', 'view', 'capture', 'diagnose'],
        handler: async (args) => {
          try {
            const base64 = await this.browserInteraction.screenshot(args.workspaceId);
            return {
              status: 'success' as const,
              data: { screenshot: `data:image/png;base64,${base64}` },
              preview: 'Browser screenshot captured successfully',
              metadata: { toolName: 'browser_screenshot', displayName: 'Browser Screenshot', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_screenshot', displayName: 'Browser Screenshot', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
        },
        estimatedLatency: 'medium',
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_get_content',
        displayName: 'Browser Read Content',
        description:
          'Reads the visible text on the current web page. ' +
          'Use to read Google Docs documents, Google Sheets data, or web content.',
        tags: ['browser', 'read', 'content', 'text'],
        handler: async (args) => {
          try {
            let content = await this.browserInteraction.getContent(args.workspaceId);
            content = this.contextQuarantine.sanitizeText(content, 'browser-content');
            return {
              status: 'success' as const,
              data: { content },
              preview: `Read ${content.length} characters from page`,
              metadata: { toolName: 'browser_get_content', displayName: 'Browser Read Content', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_get_content', displayName: 'Browser Read Content', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            maxChars: {
              type: 'number',
              description: 'Maximum characters to read (default: all)',
            },
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
        },
        estimatedLatency: 'medium',
        timeoutMs: 10000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_press_key',
        displayName: 'Tekan Tombol Keyboard',
        description:
          'Presses a keyboard key on the web page. Use for keyboard shortcuts ' +
          '(Ctrl+C to copy, Enter to submit, Tab to move fields, Escape to close dialogs, ' +
          'ArrowDown/ArrowUp to navigate, etc.).',
        tags: ['browser', 'keyboard', 'shortcut', 'interact'],
        handler: async (args) => {
          try {
            await this.browserInteraction.pressKey(args.key, args.workspaceId);
            return {
              status: 'success' as const,
              data: { key: args.key },
              preview: `Menekan tombol: ${args.key}`,
              metadata: { toolName: 'browser_press_key', displayName: 'Tekan Tombol Keyboard', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_press_key', displayName: 'Tekan Tombol Keyboard', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Key name (Enter, Tab, Escape, ArrowDown, ArrowUp, Control+a, etc.)',
            },
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
          required: ['key'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_go_back',
        displayName: 'Kembali Halaman',
        description: 'Navigates back to the previous page in the browser.',
        tags: ['browser', 'navigate', 'back'],
        handler: async (args) => {
          try {
            await this.browserInteraction.goBack(args.workspaceId);
            return {
              status: 'success' as const,
              data: {},
              preview: 'Kembali ke halaman sebelumnya',
              metadata: { toolName: 'browser_go_back', displayName: 'Kembali Halaman', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_go_back', displayName: 'Kembali Halaman', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_go_forward',
        displayName: 'Maju Halaman',
        description: 'Navigates forward to the next page in the browser.',
        tags: ['browser', 'navigate', 'forward'],
        handler: async (args) => {
          try {
            await this.browserInteraction.goForward(args.workspaceId);
            return {
              status: 'success' as const,
              data: {},
              preview: 'Maju ke halaman berikutnya',
              metadata: { toolName: 'browser_go_forward', displayName: 'Maju Halaman', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_go_forward', displayName: 'Maju Halaman', executionTime: 0 },
              error: { code: 'BROWSER_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID for session isolation (optional)' },
          },
        },
        timeoutMs: 15000,
      }),
    );

    // ─── Desktop Interaction ──────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_open_file',
        displayName: 'Buka File di Desktop',
        description:
          'Opens a file in the default desktop application (PDF in a PDF viewer, ' +
          'TXT in Notepad, CSV in Excel, images in a Photo viewer, etc.). ' +
          'The file opens visible on the user screen. Use for any file type ' +
          'that needs to be viewed/edited directly on the desktop.',
        tags: ['desktop', 'open', 'file', 'visible'],
        handler: async (args) => {
          try {
            await this.desktopBridge.sendCommand('openFile', { path: args.path });
            return {
              status: 'success' as const,
              data: { path: args.path },
              preview: `Membuka file: ${args.path.split(/[\\/]/).pop()}`,
              metadata: { toolName: 'desktop_open_file', displayName: 'Buka File di Desktop', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_open_file', displayName: 'Buka File di Desktop', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Full path of the file to open in the default desktop application',
            },
          },
          required: ['path'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_open_excel',
        displayName: 'Buka Excel',
        description:
          'Opens an Excel file (.xlsx, .xls) in the Microsoft Excel desktop application ' +
          'via COM. The file opens visible on the user screen.',
        tags: ['desktop', 'excel', 'com', 'visible'],
        handler: async (args) => {
          try {
            const r = await this.desktopBridge.sendCommand('openExcel', { path: args.path });
            return {
              status: 'success' as const,
              data: { path: args.path, hwnd: r.hwnd },
              preview: `Membuka Excel: ${args.path.split(/[\\/]/).pop()}`,
              metadata: { toolName: 'desktop_open_excel', displayName: 'Buka Excel', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_open_excel', displayName: 'Buka Excel', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Full path of the Excel file to open',
            },
          },
          required: ['path'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 20000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_open_word',
        displayName: 'Buka Word',
        description:
          'Opens a Word file (.docx, .doc) in the Microsoft Word desktop application ' +
          'via COM. The file opens visible on the user screen.',
        tags: ['desktop', 'word', 'com', 'visible'],
        handler: async (args) => {
          try {
            await this.desktopBridge.sendCommand('openWord', { path: args.path });
            return {
              status: 'success' as const,
              data: { path: args.path },
              preview: `Membuka Word: ${args.path.split(/[\\/]/).pop()}`,
              metadata: { toolName: 'desktop_open_word', displayName: 'Buka Word', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_open_word', displayName: 'Buka Word', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Full path of the Word file to open',
            },
          },
          required: ['path'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 20000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_open_ppt',
        displayName: 'Buka PowerPoint',
        description:
          'Opens a PowerPoint file (.pptx, .ppt) in the Microsoft PowerPoint desktop application ' +
          'via COM. The file opens visible on the user screen.',
        tags: ['desktop', 'ppt', 'com', 'visible'],
        handler: async (args) => {
          try {
            await this.desktopBridge.sendCommand('openPpt', { path: args.path });
            return {
              status: 'success' as const,
              data: { path: args.path },
              preview: `Membuka PowerPoint: ${args.path.split(/[\\/]/).pop()}`,
              metadata: { toolName: 'desktop_open_ppt', displayName: 'Buka PowerPoint', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_open_ppt', displayName: 'Buka PowerPoint', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Full path of the PowerPoint file to open',
            },
          },
          required: ['path'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 20000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_screenshot',
        displayName: 'Screenshot Desktop',
        description:
          'Takes a screenshot of the current desktop screen. ' +
          'Use to see what is currently displayed on the user screen, ' +
          'verify the results of desktop operations, or diagnose problems.',
        tags: ['desktop', 'screenshot', 'view', 'capture', 'diagnose'],
        handler: async () => {
          try {
            const r = await this.desktopBridge.sendCommand('screenshot', {}, 15000);
            return {
              status: 'success' as const,
              data: { screenshot: r.screenshot },
              preview: 'Screenshot desktop berhasil diambil',
              metadata: { toolName: 'desktop_screenshot', displayName: 'Screenshot Desktop', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_screenshot', displayName: 'Screenshot Desktop', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: { type: 'object', properties: {} },
        estimatedLatency: 'medium',
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_excel_edit',
        mutating: true,
        displayName: 'Edit File Excel (Native)',
        description:
          'Edits an Excel file natively via the desktop Excel application (COM). ' +
          'Supports batch actions: write cell values, insert/delete rows, insert/delete columns, format cells, and save. ' +
          'The system automatically creates a backup before editing. ' +
          'Send one or more actions in a single call for efficiency. ' +
          'Excel handles formula shifts and macros automatically.',
        tags: ['desktop', 'excel', 'edit', 'write', 'insert', 'delete', 'format', 'native', 'com'],
        handler: async (args) => {
          const startTime = Date.now();
          try {
            // Auto-resolve workspace path if filename provided without full path
            let filePath = args.path;
            if (filePath && !filePath.includes(':') && !filePath.startsWith('/')) {
              // Relative path — resolve via workspace by reading a workspace file to get its full path
              const readResult = await this.workspaceToolsService.readWorkspaceFile(
                filePath,
                args.workspaceId || '',
              );
              // Extract full path from readResult if available
              if (readResult.data?.filePath) {
                filePath = readResult.data.filePath;
              } else if (readResult.data?.path) {
                filePath = readResult.data.path;
              }
            }

            // Rolling backup before edit (failsafe: if backup fails, abort)
            if (filePath) {
              const path = await import('path');
              const dir = path.default.dirname(filePath);
              const name = path.default.basename(filePath);
              await this.workspaceToolsService.createRollingBackup(dir, name);
            }

            // Execute batch actions via COM (with automatic backend fallback if desktop bridge is offline)
            let r: any;
            try {
              r = await this.desktopBridge.excelEdit(filePath, args.actions || []);
            } catch (bridgeErr) {
              if (process.platform === 'win32' && filePath) {
                try {
                  const { execSync } = await import('child_process');
                  const path = await import('path');
                  const fs = await import('fs');
                  const pyScript = path.resolve(process.cwd(), 'scripts/excel_com_reconciler.py');
                  if (fs.existsSync(pyScript)) {
                    const actionsJson = JSON.stringify(args.actions || []).replace(/"/g, '\\"');
                    execSync(`python "${pyScript}" "${filePath}" "${actionsJson}"`, { cwd: process.cwd() });
                    r = { success: true, actionsExecuted: (args.actions || []).length };
                  } else {
                    throw bridgeErr;
                  }
                } catch {
                  throw bridgeErr;
                }
              } else {
                throw bridgeErr;
              }
            }

            const actionSummary = (args.actions || [])
              .map((a: any) => {
                switch (a.action) {
                  case 'write_cell': return `Tulis ${a.cell}="${a.value}"`;
                  case 'insert_row': return `Sisipkan baris ${a.row}`;
                  case 'delete_row': return `Hapus baris ${a.row}`;
                  case 'insert_column': return `Sisipkan kolom ${a.column}`;
                  case 'delete_column': return `Hapus kolom ${a.column}`;
                  case 'set_format': return `Format ${a.range}`;
                  case 'save': return 'Simpan';
                  default: return a.action;
                }
              })
              .join(', ');

            return {
              status: 'success' as const,
              data: { path: filePath, results: r.results, actionsExecuted: r.actionsExecuted },
              preview: `Excel berhasil diedit (${(args.actions || []).length} aksi: ${actionSummary}). Backup otomatis tersimpan.`,
              metadata: {
                toolName: 'desktop_excel_edit',
                displayName: 'Edit File Excel (Native)',
                executionTime: Date.now() - startTime,
              },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: {
                toolName: 'desktop_excel_edit',
                displayName: 'Edit File Excel (Native)',
                executionTime: Date.now() - startTime,
              },
              error: { code: 'EXCEL_EDIT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Excel file path or filename (e.g. "testing.xlsx" or full path)' },
            workspaceId: { type: 'string', description: 'Workspace ID (used to resolve relative paths)' },
            actions: {
              type: 'array',
              description: 'List of edit actions to execute in order',
              items: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['write_cell', 'insert_row', 'delete_row', 'insert_column', 'delete_column', 'set_format', 'save'],
                    description: 'Action type',
                  },
                  cell: { type: 'string', description: 'Cell address for write_cell (e.g. "A1", "B5")' },
                  value: { type: 'string', description: 'Value or formula for write_cell (e.g. "500000", "=SUM(A1:A5)")' },
                  row: { type: 'number', description: 'Row number for insert_row/delete_row (e.g. 5)' },
                  column: { type: 'string', description: 'Column letter for insert_column/delete_column (e.g. "C")' },
                  range: { type: 'string', description: 'Cell range for set_format (e.g. "A1:D1")' },
                  bold: { type: 'boolean', description: 'Bold formatting' },
                  italic: { type: 'boolean', description: 'Italic formatting' },
                  fontSize: { type: 'number', description: 'Font size' },
                  bgColor: { type: 'number', description: 'Background color index (6=yellow, 4=green)' },
                  alignment: { type: 'string', enum: ['left', 'center', 'right'], description: 'Text alignment' },
                },
                required: ['action'],
              },
            },
          },
          required: ['actions'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 30000,
      }),
    );


    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_word_type',
        mutating: true,
        displayName: 'Ketik Teks Word',
        description:
          'Types text or paragraphs directly into the active desktop Word document.',
        tags: ['desktop', 'word', 'type', 'text', 'interactive'],
        handler: async (args) => {
          try {
            await this.desktopBridge.wordType(
              args.text,
              args.addNewline,
              args.smoothStream,
              args.delayMs,
            );
            return {
              status: 'success' as const,
              data: { length: (args.text || '').length, smoothStream: !!args.smoothStream },
              preview: `Mengetik ${(args.text || '').length} karakter di Word${args.smoothStream ? ' (live stream)' : ''}`,
              metadata: { toolName: 'desktop_word_type', displayName: 'Ketik Teks Word', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_word_type', displayName: 'Ketik Teks Word', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to type in Word' },
            addNewline: { type: 'boolean', description: 'Add a new paragraph after typing (default: false)' },
            smoothStream: { type: 'boolean', description: 'Show live word-by-word typing animation on the Word screen' },
            delayMs: { type: 'number', description: 'Delay per word in milliseconds (default: 25ms)' },
          },
          required: ['text'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_word_format',
        mutating: true,
        displayName: 'Format Dokumen Word',
        description:
          'Formats text/selection in a Word document (Heading 1, Heading 2, Bold, Font Size).',
        tags: ['desktop', 'word', 'format', 'style', 'interactive'],
        handler: async (args) => {
          try {
            await this.desktopBridge.wordFormat({
              style: args.style,
              bold: args.bold,
              italic: args.italic,
              fontSize: args.fontSize,
            });
            return {
              status: 'success' as const,
              data: { style: args.style },
              preview: 'Memformat teks di Word',
              metadata: { toolName: 'desktop_word_format', displayName: 'Format Dokumen Word', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_word_format', displayName: 'Format Dokumen Word', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            style: { type: 'string', description: 'Paragraph style (e.g. "Heading 1", "Heading 2", "Normal")' },
            bold: { type: 'boolean', description: 'Bold' },
            italic: { type: 'boolean', description: 'Italic' },
            fontSize: { type: 'number', description: 'Font size' },
          },
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_send_keys',
        mutating: true,
        displayName: 'Kirim Shortcut Keyboard Desktop',
        description:
          'Presses keyboard key combinations/shortcuts in the active desktop application window ' +
          '(e.g. "^s" for Ctrl+S, "{ENTER}", "{TAB}", "^z").',
        tags: ['desktop', 'keyboard', 'shortcut', 'sendkeys', 'interactive'],
        handler: async (args) => {
          // Whitelist validation — only allow known-safe keyboard shortcuts (audit fix 5.1)
          const ALLOWED_KEYS = [
            '^s', '^z', '^y', '^c', '^v', '^x', '^a', '^p', '^b', '^i', '^u',  // Ctrl+Key
            '{ENTER}', '{TAB}', '{ESC}', '{DELETE}', '{BACKSPACE}',              // Special keys
            '{UP}', '{DOWN}', '{LEFT}', '{RIGHT}',                               // Arrow keys
            '{HOME}', '{END}', '{PGUP}', '{PGDN}',                              // Navigation
            '^{HOME}', '^{END}',                                                 // Ctrl+Nav
            '+{TAB}', '%{TAB}', '%{F4}',                                         // Shift/Alt combos
            '{F1}', '{F2}', '{F3}', '{F4}', '{F5}', '{F6}',                     // Function keys
            '{F7}', '{F8}', '{F9}', '{F10}', '{F11}', '{F12}',
          ];
          const normalizedKeys = (args.keys || '').trim().toLowerCase();
          const isAllowed = ALLOWED_KEYS.some(
            (allowed) => allowed.toLowerCase() === normalizedKeys,
          );
          if (!isAllowed) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Kombinasi keyboard "${args.keys}" tidak diizinkan. Hanya shortcut yang telah di-whitelist yang diperbolehkan.`,
              metadata: { toolName: 'desktop_send_keys', displayName: 'Kirim Shortcut Keyboard Desktop', executionTime: 0 },
              error: { code: 'KEYS_NOT_WHITELISTED', message: `Key combination "${args.keys}" is not in the allowed whitelist` },
            };
          }

          try {
            await this.desktopBridge.sendKeys(args.keys);
            return {
              status: 'success' as const,
              data: { keys: args.keys },
              preview: `Mengirim shortcut keyboard: ${args.keys}`,
              metadata: { toolName: 'desktop_send_keys', displayName: 'Kirim Shortcut Keyboard Desktop', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_send_keys', displayName: 'Kirim Shortcut Keyboard Desktop', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            keys: {
              type: 'string',
              description: 'WScript.SendKeys shortcut string (e.g. "^s" for Ctrl+S, "{ENTER}", "{TAB}")',
            },
          },
          required: ['keys'],
        },
        timeoutMs: 10000,
      }),
    );

    // ─── Multi-Document Reconciliation & Cross-Reference ─────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'doc_reconcile',
        displayName: 'Audit & Rekonsiliasi Dokumen',
        description:
          'Compares 2 sets of structured data (Excel, PDF, Word, CSV) to reconcile entries, note value differences, and detect missing data.',
        tags: ['audit', 'reconcile', 'reconciliation', 'compare', 'matrix'],
        handler: async (args) => {
          try {
            const report = this.docReconciliationService.reconcileDocuments(
              args.sourceName || 'Dokumen A',
              args.sourceRows || [],
              args.targetName || 'Dokumen B',
              args.targetRows || [],
              args.matchKey || 'id',
            );
            return {
              status: 'success' as const,
              data: report,
              preview: report.formattedTableMarkdown,
              metadata: { toolName: 'doc_reconcile', displayName: 'Audit & Rekonsiliasi Dokumen', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Gagal merekonsiliasi dokumen: ${err.message}`,
              metadata: { toolName: 'doc_reconcile', displayName: 'Audit & Rekonsiliasi Dokumen', executionTime: 0 },
              error: { code: 'RECONCILE_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            sourceName: { type: 'string', description: 'Name of the main reference document (e.g. "Invoices.xlsx")' },
            sourceRows: { type: 'array', items: { type: 'object' }, description: 'Data rows from the main reference document' },
            targetName: { type: 'string', description: 'Name of the comparison document (e.g. "Receipts.pdf")' },
            targetRows: { type: 'array', items: { type: 'object' }, description: 'Data rows from the comparison document' },
            matchKey: { type: 'string', description: 'Matching reference key (e.g. "id", "invoiceNo", "date")' },
          },
          required: ['sourceName', 'sourceRows', 'targetName', 'targetRows'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'doc_cross_reference',
        displayName: 'Pencarian Silang Dokumen Workspace',
        description:
          'Searches for entity relationships, invoice numbers, or specific keywords across all workspace document text.',
        tags: ['cross_reference', 'search', 'audit', 'workspace'],
        handler: async (args) => {
          try {
            const matches = this.docReconciliationService.crossReference(
              args.query || '',
              args.documents || [],
            );
            const summary = matches.length > 0
              ? `Ditemukan ${matches.length} dokumen yang memuat "${args.query}":\n` +
                matches.map((m) => `- **${m.documentName}** (${m.occurrenceCount} kali): "${m.contextSnippet}"`).join('\n')
              : `Teks "${args.query}" tidak ditemukan di dokumen yang diperiksa.`;

            return {
              status: 'success' as const,
              data: { query: args.query, matches },
              preview: summary,
              metadata: { toolName: 'doc_cross_reference', displayName: 'Pencarian Silang Dokumen Workspace', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Gagal melakukan pencarian silang: ${err.message}`,
              metadata: { toolName: 'doc_cross_reference', displayName: 'Pencarian Silang Dokumen Workspace', executionTime: 0 },
              error: { code: 'CROSS_REF_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Keyword/invoice number/code to search cross-referentially' },
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['name', 'content'],
              },
              description: 'List of documents with their text content to examine',
            },
          },
          required: ['query', 'documents'],
        },
        timeoutMs: 15000,
      }),
    );

    // ─── Sub-Agent Delegation Tool ───────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'agent_spawn',
        displayName: 'Delegasi Sub-Agent',
        description:
          'Delegates sub-tasks to independent sub-agents that run in parallel in the background. ' +
          'Use to break large work into several sub-tasks done simultaneously ' +
          '(e.g. read 3 PDF files in parallel, or process Excel while reading Word). ' +
          'Each sub-agent has isolated context and restricted tools.',
        tags: ['agent', 'delegation', 'parallel', 'spawn', 'sub-agent'],
        handler: async (args) => {
          try {
            const tasks = (args.tasks || []).map((t: any, i: number) => ({
              taskId: t.taskId || `sub_${Date.now()}_${i}`,
              taskName: t.taskName || `Sub-tugas ${i + 1}`,
              taskDescription: t.taskDescription || t.description || '',
              allowedTools: t.allowedTools || [],
              maxRounds: t.maxRounds || 5,
              additionalContext: t.additionalContext || '',
              workspaceId: args.workspaceId, // Inherited from parent run via enrichedArgs
            }));

            if (tasks.length === 0) {
              return {
                status: 'error' as const,
                data: {},
                preview: 'Tidak ada sub-tugas yang didefinisikan.',
                metadata: { toolName: 'agent_spawn', displayName: 'Delegasi Sub-Agent', executionTime: 0 },
                error: { code: 'NO_TASKS', message: 'Array tasks kosong.' },
              };
            }

            const results = await this.subAgentRunner.spawnParallel(tasks);

            const successCount = results.filter((r: any) => r.status === 'success').length;
            const totalDurationMs = Math.max(...results.map((r: any) => r.metadata.durationMs), 0);

            const summary = results
              .map((r: any) => {
                const icon = r.status === 'success' ? '✅' : '❌';
                const toolInfo = r.toolOutputs.length > 0
                  ? ` (${r.toolOutputs.length} tools digunakan)`
                  : '';
                return `${icon} **${r.taskName}**: ${r.status === 'success' ? r.content.substring(0, 200) : r.error}${toolInfo}`;
              })
              .join('\n');

            return {
              status: 'success' as const,
              data: {
                results: results.map((r: any) => ({
                  taskId: r.taskId,
                  taskName: r.taskName,
                  status: r.status,
                  content: r.content,
                  toolCount: r.toolOutputs.length,
                  durationMs: r.metadata.durationMs,
                  error: r.error,
                })),
                successCount,
                totalCount: results.length,
                totalDurationMs,
              },
              preview: `${successCount}/${results.length} sub-agent selesai (${totalDurationMs}ms):\n${summary}`,
              metadata: { toolName: 'agent_spawn', displayName: 'Delegasi Sub-Agent', executionTime: totalDurationMs },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Gagal menjalankan sub-agent: ${err.message}`,
              metadata: { toolName: 'agent_spawn', displayName: 'Delegasi Sub-Agent', executionTime: 0 },
              error: { code: 'SPAWN_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              description: 'List of sub-tasks to delegate to parallel sub-agents',
              items: {
                type: 'object',
                properties: {
                  taskName: { type: 'string', description: 'Short sub-task name (e.g. "Read Invoice PDF")' },
                  taskDescription: { type: 'string', description: 'Detailed instructions for the sub-agent' },
                  allowedTools: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Allowed tool names (leave empty to allow all)',
                  },
                  maxRounds: { type: 'number', description: 'Max execution rounds (default: 5)' },
                  additionalContext: { type: 'string', description: 'Optional additional context' },
                },
                required: ['taskName', 'taskDescription'],
              },
            },
          },
          required: ['tasks'],
        },
        timeoutMs: 120000,
      }),
    );

    // ─── Cron Scheduler Tools ────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'schedule_cron_job',
        mutating: true,
        displayName: 'Jadwalkan Laporan & Tugas Cron Berkala',
        description:
          'Schedules automatic report execution or recurring agent tasks in the background. ' +
          'Supports cron expressions (e.g. "0 17 * * 5" for every Friday at 5 PM) or frequency text ("daily", "weekly", "monthly").',
        tags: ['cron', 'scheduler', 'automation', 'recurring', 'report'],
        handler: async (args) => {
          try {
            if (!this.cronService) {
              return {
                status: 'error' as const,
                data: {},
                preview: 'CronService unavailable.',
                metadata: { toolName: 'schedule_cron_job', displayName: 'Schedule Cron Job', executionTime: 0 },
                error: { code: 'SERVICE_UNAVAILABLE', message: 'CronService not injected.' },
              };
            }

            const schedule = await this.cronService.createSchedule({
              workspaceId: args.workspaceId || 'default-workspace',
              name: args.name || 'Automated Recurring Report',
              reportType: args.reportType || 'laba_rugi',
              cronExpr: args.cronExpr || '0 17 * * 5',
              format: args.format || 'excel',
              agentGoal: args.agentGoal,
            });

            return {
              status: 'success' as const,
              data: schedule,
              preview: `Cron schedule "${schedule.name}" created successfully (${schedule.cronExpr}, type: ${schedule.reportType})`,
              metadata: { toolName: 'schedule_cron_job', displayName: 'Schedule Cron Job', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Failed to create cron schedule: ${err.message}`,
              metadata: { toolName: 'schedule_cron_job', displayName: 'Schedule Cron Job', executionTime: 0 },
              error: { code: 'SCHEDULE_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Report schedule name (e.g. "Weekly Revenue Summary")' },
            reportType: {
              type: 'string',
              description: 'Report type: "laba_rugi", "neraca", "rug", "stok", or "agent_run"',
            },
            cronExpr: {
              type: 'string',
              description: 'Cron expression or frequency (e.g. "0 17 * * 5", "daily", "weekly")',
            },
            format: { type: 'string', description: 'File format: "excel", "pdf", "csv"' },
            agentGoal: { type: 'string', description: 'Special instruction/goal if reportType="agent_run"' },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['name', 'workspaceId'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'list_cron_jobs',
        displayName: 'List Cron Jobs',
        description: 'Lists active automatic report schedules and recurring agent tasks.',
        tags: ['cron', 'scheduler', 'list', 'recurring'],
        handler: async (args) => {
          try {
            if (!this.cronService) {
              return {
                status: 'error' as const,
                data: { schedules: [] },
                preview: 'CronService unavailable.',
                metadata: { toolName: 'list_cron_jobs', displayName: 'List Cron Jobs', executionTime: 0 },
              };
            }

            const schedules = await this.cronService.getSchedules(args.workspaceId || 'default-workspace');
            const summary = schedules.length > 0
              ? schedules.map((s) => `- **${s.name}** (${s.cronExpr}, ${s.reportType}, active: ${s.active})`).join('\n')
              : 'No active cron schedules.';

            return {
              status: 'success' as const,
              data: { schedules, count: schedules.length },
              preview: `Found ${schedules.length} cron schedules:\n${summary}`,
              metadata: { toolName: 'list_cron_jobs', displayName: 'List Cron Jobs', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error' as const,
              data: { schedules: [] },
              preview: `Failed to retrieve cron schedules: ${err.message}`,
              metadata: { toolName: 'list_cron_jobs', displayName: 'List Cron Jobs', executionTime: 0 },
              error: { code: 'LIST_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'delete_cron_job',
        mutating: true,
        displayName: 'Delete Cron Job',
        description: 'Deletes a recurring report schedule from the system.',
        tags: ['cron', 'scheduler', 'delete', 'remove'],
        handler: async (args) => {
          try {
            if (!this.cronService) {
              return {
                status: 'error' as const,
                data: {},
                preview: 'CronService unavailable.',
                metadata: { toolName: 'delete_cron_job', displayName: 'Delete Cron Job', executionTime: 0 },
              };
            }

            if (!args.workspaceId) {
              return {
                status: 'error' as const,
                data: {},
                preview: 'Workspace ID is required.',
                metadata: { toolName: 'delete_cron_job', displayName: 'Delete Cron Job', executionTime: 0 },
              };
            }
            await this.cronService.deleteSchedule(args.id, args.workspaceId);
            return {
              status: 'success' as const,
              data: { id: args.id },
              preview: `Cron schedule ${args.id} deleted successfully.`,
              metadata: { toolName: 'delete_cron_job', displayName: 'Delete Cron Job', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Gagal menghapus jadwal cron: ${err.message}`,
              metadata: { toolName: 'delete_cron_job', displayName: 'Delete Cron Job', executionTime: 0 },
              error: { code: 'DELETE_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID of the cron schedule to delete' },
          },
          required: ['id'],
        },
        timeoutMs: 15000,
      }),
    );
  }

  private async handleGenerateExport(args: Record<string, any>): Promise<any> {
    const format = args.format || 'xlsx';
    const filename = args.filename || `export.${format}`;

    switch (format) {
      case 'csv':
        return this.documentGeneratorTool.generateCsv(
          args.rows || [],
          filename,
        );
      case 'pdf':
        return this.documentGeneratorTool.generatePdf(
          args.title || 'Dokumen',
          args.content || '',
          filename,
        );
      case 'docx':
        return this.documentGeneratorTool.generateDocx(
          args.title || 'Dokumen',
          args.content || '',
          filename,
        );
      case 'pptx':
        return this.documentGeneratorTool.generatePptx(
          args.title || 'Presentasi',
          args.slides || [{ content: args.content || '' }],
          filename,
        );
      case 'xlsx':
      default:
        return this.documentGeneratorTool.generateExcel(
          args.sheetName || 'Data',
          args.rows || [],
          filename,
        );
    }
  }
}
