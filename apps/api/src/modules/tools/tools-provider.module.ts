import { Module, OnModuleInit } from '@nestjs/common';
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

@Module({
  imports: [
    KnowledgeModule,
    StorageModule,
    SearchModule,
    FileModule,
    SkillsModule,
    MemoryModule,
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
            query: { type: 'string', description: 'Kata kunci pencarian' },
            limit: { type: 'number', description: 'Batas hasil (default: 10)' },
          },
          required: ['query'],
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
          required: ['query'],
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
          required: ['filePath'],
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
          'Membuat file laporan/dokumen baru (Excel, PDF, Word, TXT, JSON) di dalam folder Workspace.',
        tags: ['write', 'create', 'export', 'workspace', 'file'],
        handler: (args) =>
          this.workspaceToolsService.writeWorkspaceFile({
            workspacePath: args.workspacePath || process.cwd(),
            filename: args.filename,
            format: args.format,
            content: args.content,
            rows: args.rows,
            title: args.title,
          }),
        parameters: {
          type: 'object',
          properties: {
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
          required: ['filename', 'format'],
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
