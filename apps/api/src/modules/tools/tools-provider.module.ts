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

import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    KnowledgeModule,
    StorageModule,
    SearchModule,
    FileModule,
    SkillsModule,
    MemoryModule,
    AiModule,
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
          'Validasi dan normalisasi data terstruktur dari dokumen. Kirim data yang sudah diekstrak, bukan teks mentah.',
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
            documentType: { type: 'string', description: 'Jenis dokumen' },
            title: { type: 'string', description: 'Judul atau nama sumber' },
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
        description: 'Membaca file dokumen dan mengekstrak teks mentahnya.',
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
            filePath: { type: 'string', description: 'Path ke file dokumen' },
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
        description: 'Query database real-time. Hanya SELECT query.',
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
                'Aksi: query (jalankan SQL), list_tables, describe_table',
            },
            sql: { type: 'string', description: 'SQL SELECT query' },
            tableName: {
              type: 'string',
              description: 'Nama table (untuk describe_table)',
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
        description: 'Membaca teks dari gambar menggunakan OCR.',
        tags: ['image', 'ocr', 'text', 'recognition'],
        handler: (args) =>
          this.imageOcrTool.recognizeText(args.filePath, args.language),
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path ke file gambar' },
            language: {
              type: 'string',
              description: 'Bahasa OCR (default: eng)',
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
          'Mencari dokumen, knowledge, dan pesan berdasarkan kata kunci.',
        tags: ['search', 'document', 'knowledge', 'find'],
        handler: (args) =>
          this.docSearchTool.searchDocuments(args.query, args.limit),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'ID Workspace' },
            query: { type: 'string', description: 'Kata kunci pencarian' },
            limit: { type: 'number', description: 'Batas hasil (default: 10)' },
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
          'Melakukan kalkulasi numerik — subtotal, pajak, diskon, total, atau operasi matematika apapun.',
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
          'Mengonversi data terstruktur menjadi file siap download — Excel (xlsx), CSV, PDF, Word (docx), atau PowerPoint (pptx).',
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
              description: 'Format output file',
            },
            title: { type: 'string', description: 'Judul dokumen' },
            content: {
              type: 'string',
              description:
                'Isi dokumen dalam bentuk teks/markdown (untuk pdf, docx)',
            },
            sheetName: {
              type: 'string',
              description: 'Nama sheet (untuk xlsx/csv)',
            },
            rows: { type: 'array', description: 'Data baris (untuk xlsx/csv)' },
            slides: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  heading: { type: 'string' },
                  content: { type: 'string' },
                },
              },
              description: 'Slide data (untuk pptx)',
            },
            filename: { type: 'string', description: 'Nama file output' },
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
          'Menyimpan atau memperbarui Knowledge Base. Gunakan saat user ingin membuat atau mengupdate knowledge.',
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
              description: 'Judul knowledge (nama bisnis/perusahaan)',
            },
            content: {
              type: 'string',
              description: 'Isi knowledge dalam format markdown',
            },
            type: {
              type: 'string',
              description: 'Tipe knowledge berdasarkan domain bisnis',
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
          'Mencari informasi real-time di internet (harga bahan, berita pasar, kurs, kompetitor, dll).',
        tags: ['search', 'web', 'internet', 'realtime', 'google', 'tavily'],
        handler: (args) =>
          this.webSearchTool.searchWeb(args.query, args.searchDepth),
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Kata kunci atau pertanyaan yang ingin dicari di internet',
            },
            searchDepth: {
              type: 'string',
              enum: ['basic', 'advanced'],
              description:
                'Kedalaman pencarian: basic (cepat) atau advanced (mendalam)',
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
          'Menganalisis gambar/foto (struk belanja, nota lecek, kwitansi, tulisan tangan, gambar produk) menggunakan Vision AI.',
        tags: ['vision', 'ocr', 'image', 'receipt', 'nota', 'foto', 'struk'],
        handler: (args) =>
          this.visionAiTool.analyzeImage(args.imageSource, args.prompt),
        parameters: {
          type: 'object',
          properties: {
            imageSource: {
              type: 'string',
              description: 'Path file gambar lokal atau URL gambar',
            },
            prompt: {
              type: 'string',
              description:
                'Instruksi spesifik apa yang ingin diekstrak dari gambar',
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
          'Mengonversi nilai antara berbagai satuan (yard, meter, cm, roll, kg, gram, lusin, kodi) atau mata uang (usd, idr, eur, sgd).',
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
              description: 'Nilai yang akan dikonversi',
            },
            from: { type: 'string', description: 'Satuan asal' },
            to: { type: 'string', description: 'Satuan tujuan' },
            domain: {
              type: 'string',
              description: 'Tipe bisnis untuk unit spesifik',
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
          'Membuat draf pesan profesional untuk WhatsApp, Email formal, Penawaran Harga (Quotation), atau Pengingat Tagihan (Invoice Reminder).',
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
              description: 'Jenis draf komunikasi',
            },
            recipientName: {
              type: 'string',
              description: 'Nama penerima / klien',
            },
            topic: { type: 'string', description: 'Topik atau perihal pesan' },
            keyPoints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Poin-poin penting yang ingin disampaikan',
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
          'Mencari kata kunci, topik, atau data di seluruh dokumen di dalam Workspace aktif.',
        tags: ['search', 'fts', 'workspace', 'query', 'files'],
        handler: (args) =>
          this.workspaceToolsService.searchWorkspace(
            args.workspaceId,
            args.query,
          ),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'ID Workspace' },
            query: { type: 'string', description: 'Kata kunci pencarian' },
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
          'Memindai daftar seluruh file dan folder yang ada di dalam Workspace aktif.',
        tags: ['files', 'list', 'workspace', 'directory'],
        handler: (args) =>
          this.workspaceToolsService.listWorkspaceFiles(args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'ID Workspace' },
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
          'Membaca isi lengkap file dokumen (PDF, Word, Excel, CSV, TXT) di dalam workspace.',
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
              description: 'Nama file atau path lengkap file dokumen',
            },
            workspaceId: { type: 'string', description: 'ID Workspace' },
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
          'Membuat file laporan/dokumen baru (Excel, PDF, Word, TXT, JSON) di dalam folder Workspace. Path folder otomatis diambil dari database.',
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
            workspaceId: { type: 'string', description: 'ID Workspace (wajib)' },
            filename: {
              type: 'string',
              description: 'Nama file yang akan dibuat',
            },
            format: {
              type: 'string',
              enum: ['xlsx', 'csv', 'pdf', 'docx', 'txt', 'md', 'json'],
              description: 'Format dokumen',
            },
            content: { type: 'string', description: 'Isi teks/markdown' },
            rows: { type: 'array', description: 'Baris data untuk Excel/CSV' },
            title: { type: 'string', description: 'Judul dokumen' },
          },
          required: ['workspaceId', 'filename', 'format'],
        },
        outputType: 'document',
        estimatedLatency: 'medium',
        timeoutMs: 15000,
      }),
    );

    // ─── Skills ─────────────────────────────────────────────────────
    this.registry.register(
      ToolAdapter.from({
        name: 'list_skills',
        displayName: 'Daftar Skills',
        description:
          'Melihat semua skill workflow yang tersimpan. Skill adalah template workflow yang bisa dipakai ulang.',
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
          'Melihat detail skill workflow — termasuk instruksi lengkap untuk diikuti.',
        tags: ['skills', 'view', 'workflow', 'template'],
        handler: (args) => this.skillsTool.viewSkill(args.name),
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nama skill (snake_case)' },
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
        description: 'Menyimpan workflow yang berhasil sebagai skill baru.',
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
              description: 'Nama skill dalam snake_case',
            },
            displayName: { type: 'string', description: 'Nama tampilan skill' },
            description: {
              type: 'string',
              description: 'Deskripsi singkat skill',
            },
            category: {
              type: 'string',
              enum: ['general', 'data-processing', 'reporting', 'integration'],
              description: 'Kategori skill',
            },
            content: {
              type: 'string',
              description: 'Instruksi lengkap skill dalam format markdown',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tag untuk pencarian',
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
        description: 'Mencari skill berdasarkan kata kunci.',
        tags: ['skills', 'search', 'find', 'workflow'],
        handler: (args) => this.skillsTool.searchSkills(args.query),
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Kata kunci pencarian' },
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
          'Memperbarui skill yang sudah ada (konten, deskripsi, tags). Versi otomatis diincrement.',
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
              description: 'Nama skill yang akan diupdate',
            },
            displayName: { type: 'string', description: 'Nama tampilan baru' },
            description: { type: 'string', description: 'Deskripsi baru' },
            content: { type: 'string', description: 'Konten markdown baru' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags baru',
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
          'Menonaktifkan skill (soft delete). Skill tidak akan muncul di list tapi masih ada di database.',
        tags: ['skills', 'delete', 'remove', 'workflow'],
        handler: (args) => this.skillsTool.deleteSkill(args.name),
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Nama skill yang akan dinonaktifkan',
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
          'Melihat semua memory (preferensi, konteks, riwayat) yang tersimpan.',
        tags: ['memory', 'list', 'context', 'preferences'],
        handler: (args) => this.memoryTool.listMemories(args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'ID Workspace' },
          },
        },
        timeoutMs: 5000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'save_memory',
        displayName: 'Simpan Memory',
        description: 'Menyimpan informasi penting sebagai memory lintas sesi.',
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
              description: 'Jenis memory',
            },
            key: { type: 'string', description: 'Kunci unik memory' },
            content: { type: 'string', description: 'Isi memory' },
            importance: {
              type: 'number',
              description: 'Tingkat kepentingan 1-10',
            },
            domain: { type: 'string', description: 'Domain bisnis' },
            workspaceId: { type: 'string', description: 'ID Workspace' },
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
        description: 'Mencari memory berdasarkan kata kunci.',
        tags: ['memory', 'search', 'find', 'recall'],
        handler: (args) => this.memoryTool.searchMemories(args.query),
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Kata kunci pencarian' },
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
        description: 'Menghapus memory berdasarkan jenis dan kunci.',
        tags: ['memory', 'delete', 'remove'],
        handler: (args) => this.memoryTool.deleteMemory(args.type, args.key),
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Jenis memory' },
            key: { type: 'string', description: 'Kunci memory' },
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
          'Membuka halaman web (Google Docs, Google Sheets, website) di browser yang terlihat. ' +
          'Gunakan untuk membuka dokumen online atau mencari informasi di web.',
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
            url: { type: 'string', description: 'URL halaman web yang akan dibuka (https://...)' },
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
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
          'Mengklik element di halaman web menggunakan CSS selector. ' +
          'Gunakan untuk mengklik tombol, link, menu, atau cell di Google Docs/Sheets.',
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
              description: 'CSS selector element yang akan diklik (contoh: "#id", ".class", "button")',
            },
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
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
          'Mengetik teks ke dalam form field, cell spreadsheet, atau editor dokumen. ' +
          'Gunakan untuk mengisi data di Google Sheets, mengetik di Google Docs, atau mengisi form.',
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
              description: 'CSS selector element yang akan diisi teks',
            },
            text: { type: 'string', description: 'Teks yang akan diketik' },
            slowly: {
              type: 'boolean',
              description: 'Ketik perlahan karakter per karakter (default: false)',
            },
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
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
          'Mengambil screenshot halaman web saat ini. Gambar dikembalikan sebagai base64. ' +
          'Gunakan untuk melihat apa yang sedang tampil di browser dan mendiagnosis masalah.',
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
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
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
          'Membaca teks yang terlihat di halaman web saat ini. ' +
          'Gunakan untuk membaca dokumen Google Docs, data Google Sheets, atau konten web.',
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
              description: 'Maksimal karakter yang dibaca (default: semua)',
            },
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
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
          'Menekan tombol keyboard di halaman web. Gunakan untuk shortcut keyboard ' +
          '(Ctrl+C untuk copy, Enter untuk submit, Tab pindah field, Escape tutup dialog, ' +
          'ArrowDown/ArrowUp navigasi, dll).',
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
              description: 'Nama tombol (Enter, Tab, Escape, ArrowDown, ArrowUp, Control+a, dll)',
            },
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
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
        description: 'Navigasi kembali ke halaman sebelumnya di browser.',
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
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
          },
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'browser_go_forward',
        displayName: 'Maju Halaman',
        description: 'Navigasi maju ke halaman berikutnya di browser.',
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
            workspaceId: { type: 'string', description: 'Workspace ID untuk isolasi sesi (opsional)' },
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
          'Membuka file di aplikasi default desktop (PDF di PDF viewer, ' +
          'TXT di Notepad, CSV di Excel, gambar di Photo viewer, dll). ' +
          'File akan terbuka visible di layar pengguna. Gunakan untuk semua jenis file ' +
          'yang perlu dilihat/diedit langsung di desktop.',
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
              description: 'Path lengkap file yang akan dibuka di aplikasi default desktop',
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
          'Membuka file Excel (.xlsx, .xls) di aplikasi Microsoft Excel desktop ' +
          'via COM. File akan terbuka visible di layar pengguna.',
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
              description: 'Path lengkap file Excel yang akan dibuka',
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
          'Membuka file Word (.docx, .doc) di aplikasi Microsoft Word desktop ' +
          'via COM. File akan terbuka visible di layar pengguna.',
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
              description: 'Path lengkap file Word yang akan dibuka',
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
          'Membuka file PowerPoint (.pptx, .ppt) di aplikasi Microsoft PowerPoint desktop ' +
          'via COM. File akan terbuka visible di layar pengguna.',
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
              description: 'Path lengkap file PowerPoint yang akan dibuka',
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
          'Mengambil screenshot layar desktop saat ini. ' +
          'Gunakan untuk melihat apa yang sedang tampil di layar pengguna, ' +
          'memverifikasi hasil operasi desktop, atau mendiagnosis masalah.',
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
          'Menulis nilai atau formula ke cell Excel tertentu (contoh: "A1", "B5") ' +
          'di aplikasi Excel desktop yang terbuka secara visible.',
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
            path: { type: 'string', description: 'Path file Excel (opsional jika sudah terbuka)' },
            cell: { type: 'string', description: 'Alamat cell (contoh: "A1", "B5")' },
            value: { type: 'string', description: 'Nilai atau formula (contoh: "100", "=SUM(A1:A5)")' },
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
          'Memformat cell Excel (bold, warna background, alignment, ukuran font) ' +
          'di aplikasi Excel desktop yang terbuka secara visible.',
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
            path: { type: 'string', description: 'Path file Excel (opsional jika sudah terbuka)' },
            range: { type: 'string', description: 'Range cell (contoh: "A1", "A1:D1")' },
            bold: { type: 'boolean', description: 'Cetak tebal' },
            italic: { type: 'boolean', description: 'Cetak miring' },
            fontSize: { type: 'number', description: 'Ukuran font' },
            bgColor: { type: 'number', description: 'Index warna background (contoh: 6 untuk kuning, 4 untuk hijau)' },
            alignment: { type: 'string', enum: ['left', 'center', 'right'], description: 'Rata teks' },
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
          'Mengetik teks atau paragraf langsung di dokumen Word desktop yang sedang aktif.',
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
            text: { type: 'string', description: 'Teks yang akan diketik di Word' },
            addNewline: { type: 'boolean', description: 'Tambah paragraf baru setelah mengetik (default: false)' },
            smoothStream: { type: 'boolean', description: 'Tampilkan animasi pengetikan live kata-demi-kata di layar Word' },
            delayMs: { type: 'number', description: 'Jeda waktu per kata dalam milidetik (default: 25ms)' },
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
          'Memformat teks/seleksi di dokumen Word (Heading 1, Heading 2, Bold, Font Size).',
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
            style: { type: 'string', description: 'Style paragraf (contoh: "Heading 1", "Heading 2", "Normal")' },
            bold: { type: 'boolean', description: 'Cetak tebal' },
            italic: { type: 'boolean', description: 'Cetak miring' },
            fontSize: { type: 'number', description: 'Ukuran font' },
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
          'Menekan kombinasi tombol/shortcut keyboard di jendela aplikasi desktop yang aktif ' +
          '(contoh: "^s" untuk Ctrl+S, "{ENTER}", "{TAB}", "^z").',
        tags: ['desktop', 'keyboard', 'shortcut', 'sendkeys', 'interactive'],
        handler: async (args) => {
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
              description: 'String shortcut WScript.SendKeys (contoh: "^s" untuk Ctrl+S, "{ENTER}", "{TAB}")',
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
          'Membandingkan 2 kumpulan data terstruktur (Excel, PDF, Word, CSV) untuk merekonsiliasi entri, mencatat selisih nilai, dan mendeteksi data yang hilang.',
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
            sourceName: { type: 'string', description: 'Nama dokumen acuan utama (contoh: "Invoices.xlsx")' },
            sourceRows: { type: 'array', items: { type: 'object' }, description: 'Baris data dari dokumen acuan utama' },
            targetName: { type: 'string', description: 'Nama dokumen pembanding (contoh: "Receipts.pdf")' },
            targetRows: { type: 'array', items: { type: 'object' }, description: 'Baris data dari dokumen pembanding' },
            matchKey: { type: 'string', description: 'Kunci acuan pencocokan (contoh: "id", "invoiceNo", "tanggal")' },
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
          'Mencari keterkaitan entitas, nomor invoice, atau kata kunci tertentu di seluruh teks dokumen workspace.',
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
            query: { type: 'string', description: 'Kata kunci/nomor invoice/kode yang dicari secara silang' },
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
              description: 'Daftar dokumen beserta konten teksnya untuk diperiksa',
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
          'Mendelegasikan sub-tugas ke sub-agent independen yang berjalan secara paralel di background. ' +
          'Gunakan untuk memecah pekerjaan besar menjadi beberapa sub-tugas yang dikerjakan bersamaan ' +
          '(contoh: baca 3 file PDF secara paralel, atau proses Excel sambil baca Word). ' +
          'Setiap sub-agent memiliki konteks terisolasi dan tool yang dibatasi.',
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
              description: 'Daftar sub-tugas yang akan didelegasikan ke sub-agent paralel',
              items: {
                type: 'object',
                properties: {
                  taskName: { type: 'string', description: 'Nama singkat sub-tugas (contoh: "Baca PDF Tagihan")' },
                  taskDescription: { type: 'string', description: 'Instruksi detail untuk sub-agent' },
                  allowedTools: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Nama tool yang diizinkan (kosongkan untuk mengizinkan semua)',
                  },
                  maxRounds: { type: 'number', description: 'Maks putaran eksekusi (default: 5)' },
                  additionalContext: { type: 'string', description: 'Konteks tambahan opsional' },
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
          'Menjadwalkan eksekusi laporan otomatis atau tugas agen berkala di background. ' +
          'Mendukung ekspresi cron (contoh: "0 17 * * 5" untuk setiap Jumat jam 5 sore) atau teks frekuensi ("daily", "weekly", "monthly").',
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
            name: { type: 'string', description: 'Nama jadwal laporan (contoh: "Rekap Omset Mingguan")' },
            reportType: {
              type: 'string',
              description: 'Tipe laporan: "laba_rugi", "neraca", "rug", "stok", atau "agent_run"',
            },
            cronExpr: {
              type: 'string',
              description: 'Ekspresi cron atau frekuensi (contoh: "0 17 * * 5", "daily", "weekly")',
            },
            format: { type: 'string', description: 'Format file: "excel", "pdf", "csv"' },
            agentGoal: { type: 'string', description: 'Instruksi/tujuan khusus jika reportType="agent_run"' },
            workspaceId: { type: 'string', description: 'ID workspace' },
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
        description: 'Melihat daftar jadwal laporan otomatis dan tugas agen berkala yang aktif.',
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
            workspaceId: { type: 'string', description: 'ID workspace' },
          },
        },
        timeoutMs: 15000,
      }),
    );

    this.registry.register(
      ToolAdapter.from({
        name: 'delete_cron_job',
        displayName: 'Hapus Jadwal Cron Berkala',
        description: 'Menghapus jadwal laporan berkala dari sistem.',
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
            id: { type: 'string', description: 'ID jadwal cron yang akan dihapus' },
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
