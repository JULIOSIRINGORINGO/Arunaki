import { Module, OnModuleInit, Inject, Optional, forwardRef } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SearchModule } from '../search/search.module.js';
import { FileModule } from '../file/file.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolAdapter } from './services/tool-adapter.js';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { EnterpriseCalculatorTool } from './services/enterprise-calculator.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';
import { DocumentReaderTool } from './services/document-reader.tool.js';
import { DataQueryTool } from './services/data-query.tool.js';
import { ImageOcrTool } from './services/image-ocr.tool.js';
import { DocSearchTool } from './services/doc-search.tool.js';
import { KnowledgeBuilderTool } from './services/knowledge-builder.tool.js';
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
import { SubAgentRunnerService } from '../chat/sub-agent-runner.service.js';
import { CronService } from '../cron/cron.service.js';
import { CronModule } from '../cron/cron.module.js';
import { ProgrammaticVerifierService } from './services/programmatic-verifier.service.js';

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
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeBuilderTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
    SkillsTool,
    MemoryTool,
    DocumentReconciliationService,
    SubAgentRunnerService,
    ProgrammaticVerifierService,
  ],
  exports: [
    ToolRegistryService,
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeBuilderTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
    SkillsTool,
    MemoryTool,
    DocumentReconciliationService,
    ProgrammaticVerifierService,
  ],
})
export class ToolsProviderModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistryService,
    private readonly textExtractorTool: TextExtractorTool,
    private readonly calculatorTool: EnterpriseCalculatorTool,
    private readonly documentGeneratorTool: DocumentGeneratorTool,
    private readonly documentReaderTool: DocumentReaderTool,
    private readonly dataQueryTool: DataQueryTool,
    private readonly imageOcrTool: ImageOcrTool,
    private readonly docSearchTool: DocSearchTool,
    private readonly knowledgeBuilderTool: KnowledgeBuilderTool,
    private readonly webSearchTool: WebSearchTool,
    private readonly visionAiTool: VisionAiTool,
    private readonly unitConverterTool: UnitConverterTool,
    private readonly draftCommunicationTool: DraftCommunicationTool,
    private readonly workspaceToolsService: WorkspaceToolsService,
    private readonly skillsTool: SkillsTool,
    private readonly memoryTool: MemoryTool,
    private readonly browserInteraction: BrowserInteractionService,
    private readonly desktopBridge: DesktopBridgeService,
    private readonly docReconciliationService: DocumentReconciliationService,
    private readonly subAgentRunner: SubAgentRunnerService,
    @Optional() @Inject(forwardRef(() => CronService)) private readonly cronService?: CronService,
  ) {}

  onModuleInit() {
    this.registerTools();
  }

  private registerTools() {
    // ─── Data & Documents ───────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'extract_structured_data',
        displayName: 'Ekstraksi Data',
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
        displayName: 'Pembaca Dokumen',
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
        handler: (args) => this.documentReaderTool.readDocument(args.filePath),
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the document file' },
          },
          required: ['filePath'],
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
        displayName: 'OCR Gambar',
        description: 'Reads text from images using OCR.',
        tags: ['image', 'ocr', 'text', 'recognition'],
        handler: (args) =>
          this.imageOcrTool.recognizeText(args.filePath, args.language),
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the image file' },
            language: {
              type: 'string',
              description: 'OCR language (default: eng)',
            },
          },
          required: ['filePath'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 30000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'doc_search',
        displayName: 'Pencarian Dokumen',
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
      }),
    );

    // ─── Calculation & Export ───────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'calculate',
        displayName: 'Kalkulasi Harga',
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
        displayName: 'Dokumen Export',
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
            rows: { type: 'array', description: 'Row data (for xlsx/csv)' },
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
        displayName: 'Simpan Knowledge',
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
        displayName: 'Pencarian Web',
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
        displayName: 'Konverter Satuan & Mata Uang',
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
        displayName: 'Pembuat Draf Pesan & Email',
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
        displayName: 'Pencarian Workspace',
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
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'list_workspace_files',
        displayName: 'Daftar Berkas Workspace',
        description:
          'Lists all files and folders inside the active Workspace.',
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
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'read_workspace_file',
        displayName: 'Pembaca Berkas Workspace',
        description:
          'Reads the full content of a document file (PDF, Word, Excel, CSV, TXT) inside the workspace.',
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
              description: 'File name or full path of the document file',
            },
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['workspaceId', 'filePath'],
        },
        estimatedLatency: 'medium',
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'write_workspace_file',
        displayName: 'Buat File Workspace',
        description:
          'Creates a new report/document file (Excel, PDF, Word, TXT, JSON) inside the Workspace folder. Folder path is taken automatically from the database.',
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
            workspaceId: { type: 'string', description: 'Workspace ID (required)' },
            filename: {
              type: 'string',
              description: 'File name to create',
            },
            format: {
              type: 'string',
              enum: ['xlsx', 'csv', 'pdf', 'docx', 'txt', 'md', 'json'],
              description: 'Document format',
            },
            content: { type: 'string', description: 'Text/markdown content' },
            rows: { type: 'array', description: 'Data rows for Excel/CSV' },
            title: { type: 'string', description: 'Document title' },
          },
          required: ['workspaceId', 'filename', 'format'],
        },
        outputType: 'document',
        estimatedLatency: 'medium',
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'delete_workspace_file',
        displayName: 'Hapus File Workspace',
        description:
          'Deletes a file from the Workspace folder and updates the workspace index.',
        tags: ['delete', 'remove', 'unlink', 'workspace', 'file'],
        handler: (args) =>
          this.workspaceToolsService.deleteWorkspaceFile({
            workspaceId: args.workspaceId,
            filename: args.filename,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID (required)' },
            filename: {
              type: 'string',
              description: 'File name to delete (e.g. julio.txt)',
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
        name: 'rename_workspace_file',
        displayName: 'Ganti Nama File Workspace',
        description:
          'Renames an existing file inside the Workspace folder. The original file is moved to the new name, and the workspace index is updated.',
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
              description: 'File name to rename (e.g. test.txt)',
            },
            newFilename: {
              type: 'string',
              description: 'New file name (e.g. test2.txt)',
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
        name: 'edit_workspace_file',
        displayName: 'Edit File Workspace',
        description:
          'Edits an existing file via precise edit-diff: reads the full file, applies only the changed lines, keeps untouched content intact. Use for updating documents (reports, recaps, logs) without rewriting everything.',
        tags: ['edit', 'update', 'workspace', 'file', 'diff'],
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
          required: ['workspaceId', 'filename', 'instructions'],
        },
        estimatedLatency: 'slow',
        timeoutMs: 60000,
      }),
    );

    // ─── Skills ─────────────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'list_skills',
        displayName: 'Daftar Skills',
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
        displayName: 'Lihat Skill',
        description:
          'Views workflow skill details — including the full instructions to follow.',
        tags: ['skills', 'view', 'workflow', 'template'],
        handler: (args) => this.skillsTool.viewSkill(args.name),
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name (snake_case)' },
          },
          required: ['name'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'create_skill',
        displayName: 'Buat Skill',
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
          },
          required: ['name', 'displayName', 'description', 'content'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'search_skills',
        displayName: 'Cari Skills',
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
        displayName: 'Update Skill',
        description:
          'Updates an existing skill (content, description, tags). Version is incremented automatically.',
        tags: ['skills', 'update', 'edit', 'workflow'],
        handler: (args) =>
          this.skillsTool.updateSkill(args.name, {
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
          required: ['name'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'delete_skill',
        displayName: 'Hapus Skill',
        description:
          'Deactivates a skill (soft delete). The skill no longer appears in the list but still exists in the database.',
        tags: ['skills', 'delete', 'remove', 'workflow'],
        handler: (args) => this.skillsTool.deleteSkill(args.name),
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the skill to deactivate',
            },
          },
          required: ['name'],
        },
        timeoutMs: 5000,
      }),
    );

    // ─── Memory ─────────────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'list_memories',
        displayName: 'Daftar Memory',
        description:
          'Lists all stored memories (preferences, context, history).',
        tags: ['memory', 'list', 'context', 'preferences'],
        handler: (args) => this.memoryTool.listMemories(args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'save_memory',
        displayName: 'Simpan Memory',
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
          required: ['type', 'key', 'content'],
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'search_memories',
        displayName: 'Cari Memory',
        description: 'Searches for memories by keyword.',
        tags: ['memory', 'search', 'find', 'recall'],
        handler: (args) => this.memoryTool.searchMemories(args.query),
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
        name: 'delete_memory',
        displayName: 'Hapus Memory',
        description: 'Deletes a memory by type and key.',
        tags: ['memory', 'delete', 'remove'],
        handler: (args) => this.memoryTool.deleteMemory(args.type, args.key),
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Memory type' },
            key: { type: 'string', description: 'Memory key' },
          },
          required: ['type', 'key'],
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
        displayName: 'Buka Halaman Web',
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
              preview: `Halaman terbuka: ${r.title}`,
              metadata: { toolName: 'browser_navigate', displayName: 'Buka Halaman Web', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_navigate', displayName: 'Buka Halaman Web', executionTime: 0 },
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
        displayName: 'Klik Element',
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
              preview: `Mengklik: ${args.selector}`,
              metadata: { toolName: 'browser_click', displayName: 'Klik Element', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_click', displayName: 'Klik Element', executionTime: 0 },
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
        displayName: 'Ketik Teks',
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
              preview: `Mengetik ${args.text.length} karakter di: ${args.selector}`,
              metadata: { toolName: 'browser_type', displayName: 'Ketik Teks', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_type', displayName: 'Ketik Teks', executionTime: 0 },
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
        displayName: 'Screenshot Halaman',
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
              preview: 'Screenshot halaman berhasil diambil',
              metadata: { toolName: 'browser_screenshot', displayName: 'Screenshot Halaman', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_screenshot', displayName: 'Screenshot Halaman', executionTime: 0 },
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
        displayName: 'Baca Konten Halaman',
        description:
          'Reads the visible text on the current web page. ' +
          'Use to read Google Docs documents, Google Sheets data, or web content.',
        tags: ['browser', 'read', 'content', 'text'],
        handler: async (args) => {
          try {
            const content = await this.browserInteraction.getContent(args.workspaceId);
            return {
              status: 'success' as const,
              data: { content },
              preview: `Membaca ${content.length} karakter dari halaman`,
              metadata: { toolName: 'browser_get_content', displayName: 'Baca Konten Halaman', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'browser_get_content', displayName: 'Baca Konten Halaman', executionTime: 0 },
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
        name: 'desktop_excel_write_cell',
        displayName: 'Tulis Cell Excel',
        description:
          'Writes a value or formula to a specific Excel cell (e.g. "A1", "B5") ' +
          'in the desktop Excel application that is open visibly.',
        tags: ['desktop', 'excel', 'write', 'cell', 'interactive'],
        handler: async (args) => {
          try {
            const r = await this.desktopBridge.excelWriteCell(args.path, args.cell, args.value);
            return {
              status: 'success' as const,
              data: { cell: args.cell, value: args.value },
              preview: `Menulis "${args.value}" ke cell ${args.cell} di Excel`,
              metadata: { toolName: 'desktop_excel_write_cell', displayName: 'Tulis Cell Excel', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_excel_write_cell', displayName: 'Tulis Cell Excel', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Excel file path (optional if already open)' },
            cell: { type: 'string', description: 'Cell address (e.g. "A1", "B5")' },
            value: { type: 'string', description: 'Value or formula (e.g. "100", "=SUM(A1:A5)")' },
          },
          required: ['cell', 'value'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_excel_set_format',
        displayName: 'Format Cell Excel',
        description:
          'Formats Excel cells (bold, background color, alignment, font size) ' +
          'in the desktop Excel application that is open visibly.',
        tags: ['desktop', 'excel', 'format', 'style', 'interactive'],
        handler: async (args) => {
          try {
            await this.desktopBridge.excelSetFormat(args.path, args.range, {
              bold: args.bold,
              italic: args.italic,
              fontSize: args.fontSize,
              bgColor: args.bgColor,
              alignment: args.alignment,
            });
            return {
              status: 'success' as const,
              data: { range: args.range },
              preview: `Memformat range ${args.range} di Excel`,
              metadata: { toolName: 'desktop_excel_set_format', displayName: 'Format Cell Excel', executionTime: 0 },
            };
          } catch (err) {
            return {
              status: 'error' as const,
              data: {},
              preview: err.message,
              metadata: { toolName: 'desktop_excel_set_format', displayName: 'Format Cell Excel', executionTime: 0 },
              error: { code: 'DESKTOP_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Excel file path (optional if already open)' },
            range: { type: 'string', description: 'Cell range (e.g. "A1", "A1:D1")' },
            bold: { type: 'boolean', description: 'Bold' },
            italic: { type: 'boolean', description: 'Italic' },
            fontSize: { type: 'number', description: 'Font size' },
            bgColor: { type: 'number', description: 'Background color index (e.g. 6 for yellow, 4 for green)' },
            alignment: { type: 'string', enum: ['left', 'center', 'right'], description: 'Text alignment' },
          },
          required: ['range'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'desktop_word_type',
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

            const successCount = results.filter((r) => r.status === 'success').length;
            const totalDurationMs = Math.max(...results.map((r) => r.metadata.durationMs), 0);

            const summary = results
              .map((r) => {
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
                results: results.map((r) => ({
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
                preview: 'CronService tidak tersedia.',
                metadata: { toolName: 'schedule_cron_job', displayName: 'Jadwalkan Laporan Cron', executionTime: 0 },
                error: { code: 'SERVICE_UNAVAILABLE', message: 'CronService not injected.' },
              };
            }

            const schedule = await this.cronService.createSchedule({
              workspaceId: args.workspaceId || 'default-workspace',
              name: args.name || 'Laporan Otomatis Berkala',
              reportType: args.reportType || 'laba_rugi',
              cronExpr: args.cronExpr || '0 17 * * 5',
              format: args.format || 'excel',
              agentGoal: args.agentGoal,
            });

            return {
              status: 'success' as const,
              data: schedule,
              preview: `Jadwal cron "${schedule.name}" berhasil dibuat (${schedule.cronExpr}, tipe: ${schedule.reportType})`,
              metadata: { toolName: 'schedule_cron_job', displayName: 'Jadwalkan Laporan Cron', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Gagal membuat jadwal cron: ${err.message}`,
              metadata: { toolName: 'schedule_cron_job', displayName: 'Jadwalkan Laporan Cron', executionTime: 0 },
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
          required: ['name'],
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'list_cron_jobs',
        displayName: 'Daftar Jadwal Cron Berkala',
        description: 'Lists active automatic report schedules and recurring agent tasks.',
        tags: ['cron', 'scheduler', 'list', 'recurring'],
        handler: async (args) => {
          try {
            if (!this.cronService) {
              return {
                status: 'error' as const,
                data: { schedules: [] },
                preview: 'CronService tidak tersedia.',
                metadata: { toolName: 'list_cron_jobs', displayName: 'Daftar Jadwal Cron', executionTime: 0 },
              };
            }

            const schedules = await this.cronService.getSchedules(args.workspaceId || 'default-workspace');
            const summary = schedules.length > 0
              ? schedules.map((s) => `- **${s.name}** (${s.cronExpr}, ${s.reportType}, active: ${s.active})`).join('\n')
              : 'Tidak ada jadwal cron aktif.';

            return {
              status: 'success' as const,
              data: { schedules, count: schedules.length },
              preview: `Ditemukan ${schedules.length} jadwal cron:\n${summary}`,
              metadata: { toolName: 'list_cron_jobs', displayName: 'Daftar Jadwal Cron', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error' as const,
              data: { schedules: [] },
              preview: `Gagal mengambil daftar cron: ${err.message}`,
              metadata: { toolName: 'list_cron_jobs', displayName: 'Daftar Jadwal Cron', executionTime: 0 },
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
        displayName: 'Hapus Jadwal Cron Berkala',
        description: 'Deletes a recurring report schedule from the system.',
        tags: ['cron', 'scheduler', 'delete', 'remove'],
        handler: async (args) => {
          try {
            if (!this.cronService) {
              return {
                status: 'error' as const,
                data: {},
                preview: 'CronService tidak tersedia.',
                metadata: { toolName: 'delete_cron_job', displayName: 'Hapus Jadwal Cron', executionTime: 0 },
              };
            }

            await this.cronService.deleteSchedule(args.id);
            return {
              status: 'success' as const,
              data: { id: args.id },
              preview: `Jadwal cron ${args.id} telah dihapus.`,
              metadata: { toolName: 'delete_cron_job', displayName: 'Hapus Jadwal Cron', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error' as const,
              data: {},
              preview: `Gagal menghapus jadwal cron: ${err.message}`,
              metadata: { toolName: 'delete_cron_job', displayName: 'Hapus Jadwal Cron', executionTime: 0 },
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
