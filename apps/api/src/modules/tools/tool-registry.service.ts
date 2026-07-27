import { Injectable, Logger } from '@nestjs/common';
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
import {
  ToolResult,
  ToolDefinition,
  ToolCapability,
} from './interfaces/tool-result.interface.js';

interface RegisteredTool {
  handler: (args: Record<string, any>) => Promise<ToolResult> | ToolResult;
  definition: ToolDefinition;
  capability: ToolCapability;
  timeoutMs: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(
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
  ) {
    this.registerBuiltinTools();
  }

  private registerBuiltinTools(): void {
    this.register('extract_structured_data', {
      handler: (args) =>
        this.textExtractorTool.extractStructuredData({
          documentType: args.documentType,
          title: args.title,
          items: args.items,
          totals: args.totals,
          metadata: args.metadata,
        }),
      definition: {
        type: 'function',
        function: {
          name: 'extract_structured_data',
          description:
            'Validasi dan normalisasi data terstruktur dari dokumen. Kirim data yang sudah diekstrak, bukan teks mentah.',
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
        },
      },
      capability: {
        name: 'extract_structured_data',
        displayName: 'Ekstraksi Data',
        description: 'Validasi dan normalisasi data terstruktur',
        tags: ['extract', 'data', 'validate'],
        inputSchema: { documentType: 'string', title: 'string', items: 'array', totals: 'object' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('document_reader', {
      handler: (args) =>
        this.documentReaderTool.readDocument(args.filePath),
      definition: {
        type: 'function',
        function: {
          name: 'document_reader',
          description: 'Membaca file dokumen dan mengekstrak teks mentahnya.',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path ke file dokumen',
              },
            },
            required: ['filePath'],
          },
        },
      },
      capability: {
        name: 'document_reader',
        displayName: 'Pembaca Dokumen',
        description: 'Membaca file dokumen dan mengekstrak teks',
        tags: ['read', 'document', 'file', 'pdf', 'docx', 'excel', 'csv', 'text'],
        inputSchema: { filePath: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 10000,
    });

    this.register('data_query', {
      handler: async (args) => {
        if (args.action === 'list_tables') {
          return this.dataQueryTool.listTables();
        }
        if (args.action === 'describe_table' && args.tableName) {
          return this.dataQueryTool.describeTable(args.tableName);
        }
        return this.dataQueryTool.queryData(args.sql || '');
      },
      definition: {
        type: 'function',
        function: {
          name: 'data_query',
          description: 'Query database real-time. Hanya SELECT query.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['query', 'list_tables', 'describe_table'],
                description: 'Aksi: query (jalankan SQL), list_tables, describe_table',
              },
              sql: {
                type: 'string',
                description: 'SQL SELECT query',
              },
              tableName: {
                type: 'string',
                description: 'Nama table (untuk describe_table)',
              },
            },
            required: ['action'],
          },
        },
      },
      capability: {
        name: 'data_query',
        displayName: 'Query Database',
        description: 'Query database real-time',
        tags: ['database', 'query', 'sql', 'realtime'],
        inputSchema: { action: 'string', sql: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 10000,
    });

    this.register('image_ocr', {
      handler: (args) =>
        this.imageOcrTool.recognizeText(args.filePath, args.language),
      definition: {
        type: 'function',
        function: {
          name: 'image_ocr',
          description: 'Membaca teks dari gambar menggunakan OCR.',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path ke file gambar',
              },
              language: {
                type: 'string',
                description: 'Bahasa OCR (default: eng)',
              },
            },
            required: ['filePath'],
          },
        },
      },
      capability: {
        name: 'image_ocr',
        displayName: 'OCR Gambar',
        description: 'Membaca teks dari gambar',
        tags: ['image', 'ocr', 'text', 'recognition'],
        inputSchema: { filePath: 'string', language: 'string' },
        outputType: 'text',
        estimatedLatency: 'medium',
      },
      timeoutMs: 30000,
    });

    this.register('doc_search', {
      handler: (args) =>
        this.docSearchTool.searchDocuments(args.query, args.limit),
      definition: {
        type: 'function',
        function: {
          name: 'doc_search',
          description: 'Mencari dokumen, knowledge, dan pesan berdasarkan kata kunci.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Kata kunci pencarian',
              },
              limit: {
                type: 'number',
                description: 'Batas hasil (default: 10)',
              },
            },
            required: ['query'],
          },
        },
      },
      capability: {
        name: 'doc_search',
        displayName: 'Pencarian Dokumen',
        description: 'Mencari dokumen dan knowledge',
        tags: ['search', 'document', 'knowledge', 'find'],
        inputSchema: { query: 'string', limit: 'number' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 10000,
    });

    this.register('calculate', {
      handler: (args) =>
        this.calculatorTool.calculateFinancials(
          args.items || [],
          args.taxPercent || 0,
          args.discountPercent || 0,
        ),
      definition: {
        type: 'function',
        function: {
          name: 'calculate',
          description:
            'Melakukan kalkulasi numerik — subtotal, pajak, diskon, total, atau operasi matematika apapun.',
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
        },
      },
      capability: {
        name: 'calculate',
        displayName: 'Kalkulasi Harga',
        description: 'Kalkulasi numerik — subtotal, pajak, diskon, total',
        tags: ['calculate', 'math', 'finance', 'tax', 'discount', 'total'],
        inputSchema: { items: 'array', taxPercent: 'number', discountPercent: 'number' },
        outputType: 'calculation',
        estimatedLatency: 'fast',
      },
      timeoutMs: 3000,
    });

    this.register('generate_export', {
      handler: (args) => this.handleGenerateExport(args),
      definition: {
        type: 'function',
        function: {
          name: 'generate_export',
          description:
            'Mengonversi data terstruktur menjadi file siap download — Excel (xlsx), CSV, PDF, Word (docx), atau PowerPoint (pptx).',
          parameters: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                enum: ['xlsx', 'csv', 'pdf', 'docx', 'pptx'],
                description: 'Format output file',
              },
              title: {
                type: 'string',
                description: 'Judul dokumen',
              },
              content: {
                type: 'string',
                description: 'Isi dokumen dalam bentuk teks/markdown (untuk pdf, docx)',
              },
              sheetName: {
                type: 'string',
                description: 'Nama sheet (untuk xlsx/csv)',
              },
              rows: {
                type: 'array',
                description: 'Data baris (untuk xlsx/csv)',
              },
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
              filename: {
                type: 'string',
                description: 'Nama file output',
              },
            },
            required: ['format'],
          },
        },
      },
      capability: {
        name: 'generate_export',
        displayName: 'Dokumen Export',
        description: 'Generate file document dalam berbagai format',
        tags: [
          'export', 'document', 'pdf', 'docx', 'pptx', 'xlsx', 'csv',
          'spreadsheet', 'presentation', 'invoice', 'report',
        ],
        inputSchema: { format: 'string', title: 'string', content: 'string' },
        outputType: 'document',
        estimatedLatency: 'medium',
      },
      timeoutMs: 15000,
    });

    this.register('save_knowledge', {
      handler: (args) =>
        this.knowledgeBuilderTool.saveKnowledge(
          args.title,
          args.content,
          args.type,
        ),
      definition: {
        type: 'function',
        function: {
          name: 'save_knowledge',
          description:
            'Menyimpan atau memperbarui Knowledge Base. Gunakan saat user ingin membuat atau mengupdate knowledge.',
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
                description: 'Tipe knowledge berdasarkan domain bisnis (garment, restaurant, retail, generic, dll)',
              },
            },
            required: ['title', 'content'],
          },
        },
      },
      capability: {
        name: 'save_knowledge',
        displayName: 'Simpan Knowledge',
        description: 'Menyimpan atau memperbarui Knowledge Base',
        tags: ['knowledge', 'save', 'create', 'update', 'base'],
        inputSchema: { title: 'string', content: 'string', type: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('web_search', {
      handler: (args) =>
        this.webSearchTool.searchWeb(args.query, args.searchDepth),
      definition: {
        type: 'function',
        function: {
          name: 'web_search',
          description:
            'Mencari informasi real-time di internet (harga bahan, berita pasar, kurs, kompetitor, dll).',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Kata kunci atau pertanyaan yang ingin dicari di internet',
              },
              searchDepth: {
                type: 'string',
                enum: ['basic', 'advanced'],
                description: 'Kedalaman pencarian: basic (cepat) atau advanced (mendalam)',
              },
            },
            required: ['query'],
          },
        },
      },
      capability: {
        name: 'web_search',
        displayName: 'Pencarian Web',
        description: 'Mencari informasi real-time di internet',
        tags: ['search', 'web', 'internet', 'realtime', 'google', 'tavily'],
        inputSchema: { query: 'string', searchDepth: 'string' },
        outputType: 'text',
        estimatedLatency: 'medium',
      },
      timeoutMs: 15000,
    });

    this.register('vision_ai', {
      handler: (args) =>
        this.visionAiTool.analyzeImage(args.imageSource, args.prompt),
      definition: {
        type: 'function',
        function: {
          name: 'vision_ai',
          description:
            'Menganalisis gambar/foto (struk belanja, nota lecek, kwitansi, tulisan tangan, gambar produk) menggunakan Vision AI.',
          parameters: {
            type: 'object',
            properties: {
              imageSource: {
                type: 'string',
                description: 'Path file gambar lokal atau URL gambar',
              },
              prompt: {
                type: 'string',
                description: 'Instruksi spesifik apa yang ingin diekstrak dari gambar',
              },
            },
            required: ['imageSource'],
          },
        },
      },
      capability: {
        name: 'vision_ai',
        displayName: 'Vision AI',
        description: 'Menganalisis dan membaca foto nota/struk/dokumen fisik',
        tags: ['vision', 'ocr', 'image', 'receipt', 'nota', 'foto', 'struk'],
        inputSchema: { imageSource: 'string', prompt: 'string' },
        outputType: 'text',
        estimatedLatency: 'medium',
      },
      timeoutMs: 25000,
    });

    this.register('unit_converter', {
      handler: (args) =>
        this.unitConverterTool.convert({
          value: Number(args.value),
          from: args.from,
          to: args.to,
          domain: args.domain,
        }),
      definition: {
        type: 'function',
        function: {
          name: 'unit_converter',
          description:
            'Mengonversi nilai antara berbagai satuan (yard, meter, cm, roll, kg, gram, lusin, kodi) atau mata uang (usd, idr, eur, sgd).',
          parameters: {
            type: 'object',
            properties: {
              value: { type: 'number', description: 'Nilai yang akan dikonversi' },
              from: { type: 'string', description: 'Satuan asal (contoh: yard, meter, kg, usd, idr, pcs)' },
              to: { type: 'string', description: 'Satuan tujuan (contoh: meter, yard, idr, usd, kg)' },
              domain: { type: 'string', description: 'Tipe bisnis untuk unit spesifik (garment, restaurant, retail, generic). Default: generic' },
            },
            required: ['value', 'from', 'to'],
          },
        },
      },
      capability: {
        name: 'unit_converter',
        displayName: 'Konverter Satuan & Mata Uang',
        description: 'Mengonversi satuan dan mata uang berdasarkan konfigurasi domain bisnis',
        tags: ['converter', 'unit', 'currency', 'domain-config'],
        inputSchema: { value: 'number', from: 'string', to: 'string', domain: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('draft_communication', {
      handler: (args) =>
        this.draftCommunicationTool.draft({
          type: args.type,
          recipientName: args.recipientName,
          topic: args.topic,
          keyPoints: args.keyPoints,
        }),
      definition: {
        type: 'function',
        function: {
          name: 'draft_communication',
          description:
            'Membuat draf pesan profesional untuk WhatsApp, Email formal, Penawaran Harga (Quotation), atau Pengingat Tagihan (Invoice Reminder).',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['whatsapp', 'email', 'quotation', 'invoice_reminder'],
                description: 'Jenis draf komunikasi',
              },
              recipientName: { type: 'string', description: 'Nama penerima / klien' },
              topic: { type: 'string', description: 'Topik atau perihal pesan' },
              keyPoints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Poin-poin penting yang ingin disampaikan',
              },
            },
            required: ['type', 'recipientName', 'topic'],
          },
        },
      },
      capability: {
        name: 'draft_communication',
        displayName: 'Pembuat Draf Pesan & Email',
        description: 'Membuat draf pesan WhatsApp, Email, dan Quotation secara profesional',
        tags: ['draft', 'whatsapp', 'email', 'quotation', 'invoice', 'communication'],
        inputSchema: { type: 'string', recipientName: 'string', topic: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('search_workspace', {
      handler: (args) => this.workspaceToolsService.searchWorkspace(args.workspaceId, args.query),
      definition: {
        type: 'function',
        function: {
          name: 'search_workspace',
          description: 'Mencari kata kunci, topik, atau data di seluruh dokumen di dalam Workspace aktif.',
          parameters: {
            type: 'object',
            properties: {
              workspaceId: { type: 'string', description: 'ID Workspace' },
              query: { type: 'string', description: 'Kata kunci pencarian' },
            },
            required: ['query'],
          },
        },
      },
      capability: {
        name: 'search_workspace',
        displayName: 'Pencarian Workspace',
        description: 'Mencari kata kunci lintas file dokumen workspace',
        tags: ['search', 'fts', 'workspace', 'query', 'files'],
        inputSchema: { query: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 8000,
    });

    this.register('list_workspace_files', {
      handler: (args) => this.workspaceToolsService.listWorkspaceFiles(args.workspaceId),
      definition: {
        type: 'function',
        function: {
          name: 'list_workspace_files',
          description: 'Memindai daftar seluruh file dan folder yang ada di dalam Workspace aktif.',
          parameters: {
            type: 'object',
            properties: {
              workspaceId: { type: 'string', description: 'ID Workspace' },
            },
          },
        },
      },
      capability: {
        name: 'list_workspace_files',
        displayName: 'Daftar Berkas Workspace',
        description: 'Memindai seluruh dokumen di workspace',
        tags: ['files', 'list', 'workspace', 'directory'],
        inputSchema: {},
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('read_workspace_file', {
      handler: (args) => this.workspaceToolsService.readWorkspaceFile(args.filePath, args.workspaceId),
      definition: {
        type: 'function',
        function: {
          name: 'read_workspace_file',
          description: 'Membaca isi lengkap file dokumen (PDF, Word, Excel, CSV, TXT) di dalam workspace. Bisa pakai nama file atau path lengkap.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Nama file atau path lengkap file dokumen (dari hasil list_workspace_files)' },
              workspaceId: { type: 'string', description: 'ID Workspace (diisi otomatis)' },
            },
            required: ['filePath'],
          },
        },
      },
      capability: {
        name: 'read_workspace_file',
        displayName: 'Pembaca Berkas Workspace',
        description: 'Membaca teks dokumen spesifik di workspace',
        tags: ['read', 'pdf', 'docx', 'xlsx', 'csv', 'workspace'],
        inputSchema: { filePath: 'string' },
        outputType: 'text',
        estimatedLatency: 'medium',
      },
      timeoutMs: 15000,
    });

    this.register('write_workspace_file', {
      handler: (args) =>
        this.workspaceToolsService.writeWorkspaceFile({
          workspacePath: args.workspacePath || process.cwd(),
          filename: args.filename,
          format: args.format,
          content: args.content,
          rows: args.rows,
          title: args.title,
        }),
      definition: {
        type: 'function',
        function: {
          name: 'write_workspace_file',
          description: 'Membuat file laporan/dokumen baru (Excel, PDF, Word, TXT, JSON) di dalam folder Workspace.',
          parameters: {
            type: 'object',
            properties: {
              filename: { type: 'string', description: 'Nama file yang akan dibuat (misal: laporan.xlsx)' },
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
        },
      },
      capability: {
        name: 'write_workspace_file',
        displayName: 'Buat File Workspace',
        description: 'Membuat dokumen baru di folder workspace',
        tags: ['write', 'create', 'export', 'workspace', 'file'],
        inputSchema: { filename: 'string', format: 'string' },
        outputType: 'document',
        estimatedLatency: 'medium',
      },
      timeoutMs: 15000,
    });

    this.register('list_skills', {
      handler: () => this.skillsTool.listSkills(),
      definition: {
        type: 'function',
        function: {
          name: 'list_skills',
          description: 'Melihat semua skill workflow yang tersimpan. Skill adalah template workflow yang bisa dipakai ulang.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      capability: {
        name: 'list_skills',
        displayName: 'Daftar Skills',
        description: 'Melihat semua skill workflow tersimpan',
        tags: ['skills', 'list', 'workflow', 'template'],
        inputSchema: {},
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('view_skill', {
      handler: (args) => this.skillsTool.viewSkill(args.name),
      definition: {
        type: 'function',
        function: {
          name: 'view_skill',
          description: 'Melihat detail skill workflow — termasuk instruksi lengkap untuk diikuti.',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Nama skill (snake_case, misal: rekap_penjualan)',
              },
            },
            required: ['name'],
          },
        },
      },
      capability: {
        name: 'view_skill',
        displayName: 'Lihat Skill',
        description: 'Melihat detail dan instruksi skill workflow',
        tags: ['skills', 'view', 'workflow', 'template'],
        inputSchema: { name: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('create_skill', {
      handler: (args) => this.skillsTool.createSkill({
        name: args.name,
        displayName: args.displayName,
        description: args.description,
        category: args.category,
        content: args.content,
        tags: args.tags,
      }),
      definition: {
        type: 'function',
        function: {
          name: 'create_skill',
          description: 'Menyimpan workflow yang berhasil sebagai skill baru. Gunakan setelah menyelesaikan tugas kompleks dengan sukses.',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Nama skill dalam snake_case (misal: rekap_penjualan_bulanan)',
              },
              displayName: {
                type: 'string',
                description: 'Nama tampilan skill (misal: Rekap Penjualan Bulanan)',
              },
              description: {
                type: 'string',
                description: 'Deskripsi singkat skill (maks 120 karakter)',
              },
              category: {
                type: 'string',
                enum: ['general', 'data-processing', 'reporting', 'integration'],
                description: 'Kategori skill',
              },
              content: {
                type: 'string',
                description: 'Instruksi lengkap skill dalam format markdown. Berisi langkah-langkah workflow yang bisa diikuti.',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tag untuk pencarian (misal: ["penjualan", "bulanan", "excel"])',
              },
            },
            required: ['name', 'displayName', 'description', 'content'],
          },
        },
      },
      capability: {
        name: 'create_skill',
        displayName: 'Buat Skill',
        description: 'Menyimpan workflow sebagai skill baru',
        tags: ['skills', 'create', 'workflow', 'template', 'save'],
        inputSchema: { name: 'string', displayName: 'string', description: 'string', content: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('search_skills', {
      handler: (args) => this.skillsTool.searchSkills(args.query),
      definition: {
        type: 'function',
        function: {
          name: 'search_skills',
          description: 'Mencari skill berdasarkan kata kunci.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Kata kunci pencarian',
              },
            },
            required: ['query'],
          },
        },
      },
      capability: {
        name: 'search_skills',
        displayName: 'Cari Skills',
        description: 'Mencari skill berdasarkan kata kunci',
        tags: ['skills', 'search', 'find', 'workflow'],
        inputSchema: { query: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('update_skill', {
      handler: (args) =>
        this.skillsTool.updateSkill(args.name, {
          displayName: args.displayName,
          description: args.description,
          content: args.content,
          tags: args.tags,
        }),
      definition: {
        type: 'function',
        function: {
          name: 'update_skill',
          description: 'Memperbarui skill yang sudah ada (konten, deskripsi, tags). Versi otomatis diincrement.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nama skill yang akan diupdate' },
              displayName: { type: 'string', description: 'Nama tampilan baru (opsional)' },
              description: { type: 'string', description: 'Deskripsi baru (opsional)' },
              content: { type: 'string', description: 'Konten markdown baru (opsional)' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags baru (opsional)' },
            },
            required: ['name'],
          },
        },
      },
      capability: {
        name: 'update_skill',
        displayName: 'Update Skill',
        description: 'Memperbarui skill yang sudah ada',
        tags: ['skills', 'update', 'edit', 'workflow'],
        inputSchema: { name: 'string', content: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('delete_skill', {
      handler: (args) => this.skillsTool.deleteSkill(args.name),
      definition: {
        type: 'function',
        function: {
          name: 'delete_skill',
          description: 'Menonaktifkan skill (soft delete). Skill tidak akan muncul di list tapi masih ada di database.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nama skill yang akan dinonaktifkan' },
            },
            required: ['name'],
          },
        },
      },
      capability: {
        name: 'delete_skill',
        displayName: 'Hapus Skill',
        description: 'Menonaktifkan skill',
        tags: ['skills', 'delete', 'remove', 'workflow'],
        inputSchema: { name: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('list_memories', {
      handler: (args) => this.memoryTool.listMemories(args.workspaceId),
      definition: {
        type: 'function',
        function: {
          name: 'list_memories',
          description: 'Melihat semua memory (preferensi, konteks, riwayat) yang tersimpan.',
          parameters: {
            type: 'object',
            properties: {
              workspaceId: {
                type: 'string',
                description: 'ID Workspace (opsional, untuk melihat memory spesifik workspace)',
              },
            },
          },
        },
      },
      capability: {
        name: 'list_memories',
        displayName: 'Daftar Memory',
        description: 'Melihat semua memory tersimpan',
        tags: ['memory', 'list', 'context', 'preferences'],
        inputSchema: {},
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('save_memory', {
      handler: (args) => this.memoryTool.saveMemory({
        type: args.type,
        key: args.key,
        content: args.content,
        importance: args.importance,
        workspaceId: args.workspaceId,
      }),
      definition: {
        type: 'function',
        function: {
          name: 'save_memory',
          description: 'Menyimpan informasi penting sebagai memory (preferensi, konteks, riwayat).',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['preference', 'context', 'interaction', 'workspace_history'],
                description: 'Jenis memory: preference (suka/tidak suka), context (info penting), interaction (riwayat kerja), workspace_history (riwayat workspace)',
              },
              key: {
                type: 'string',
                description: 'Kunci unik memory (misal: "user_name", "format_output")',
              },
              content: {
                type: 'string',
                description: 'Isi memory',
              },
              importance: {
                type: 'number',
                description: 'Tingkat kepentingan 1-10 (default: 5)',
              },
              workspaceId: {
                type: 'string',
                description: 'ID Workspace (opsional, untuk memory spesifik workspace)',
              },
            },
            required: ['type', 'key', 'content'],
          },
        },
      },
      capability: {
        name: 'save_memory',
        displayName: 'Simpan Memory',
        description: 'Menyimpan informasi penting sebagai memory',
        tags: ['memory', 'save', 'remember', 'preference', 'context'],
        inputSchema: { type: 'string', key: 'string', content: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('search_memories', {
      handler: (args) => this.memoryTool.searchMemories(args.query),
      definition: {
        type: 'function',
        function: {
          name: 'search_memories',
          description: 'Mencari memory berdasarkan kata kunci.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Kata kunci pencarian',
              },
            },
            required: ['query'],
          },
        },
      },
      capability: {
        name: 'search_memories',
        displayName: 'Cari Memory',
        description: 'Mencari memory berdasarkan kata kunci',
        tags: ['memory', 'search', 'find', 'recall'],
        inputSchema: { query: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });

    this.register('delete_memory', {
      handler: (args) => this.memoryTool.deleteMemory(args.type, args.key),
      definition: {
        type: 'function',
        function: {
          name: 'delete_memory',
          description: 'Menghapus memory berdasarkan jenis dan kunci.',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Jenis memory',
              },
              key: {
                type: 'string',
                description: 'Kunci memory',
              },
            },
            required: ['type', 'key'],
          },
        },
      },
      capability: {
        name: 'delete_memory',
        displayName: 'Hapus Memory',
        description: 'Menghapus memory',
        tags: ['memory', 'delete', 'remove'],
        inputSchema: { type: 'string', key: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
    });
  }

  register(
    name: string,
    tool: {
      handler: (args: Record<string, any>) => Promise<ToolResult> | ToolResult;
      definition: ToolDefinition;
      capability: ToolCapability;
      timeoutMs?: number;
    },
  ): void {
    this.tools.set(name, {
      ...tool,
      timeoutMs: tool.timeoutMs ?? 10000,
    });
    this.logger.log(`Tool registered: ${name} (timeout: ${tool.timeoutMs ?? 10000}ms)`);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  getToolCapabilities(): ToolCapability[] {
    return Array.from(this.tools.values()).map((t) => t.capability);
  }

  getToolsByTags(tags: string[]): ToolCapability[] {
    return this.getToolCapabilities().filter((cap) =>
      tags.some((tag) => cap.tags.includes(tag)),
    );
  }

  validateArgs(
    args: Record<string, any>,
    parameters: Record<string, any>,
  ): ValidationResult {
    const errors: string[] = [];
    const required: string[] = parameters.required || [];
    const properties: Record<string, any> = parameters.properties || {};

    for (const field of required) {
      if (args[field] === undefined || args[field] === null) {
        errors.push(`Field "${field}" wajib diisi`);
      }
    }

    for (const [key, schema] of Object.entries(properties)) {
      const value = args[key];
      if (value === undefined || value === null) continue;

      const expectedType = (schema as any).type;
      if (expectedType === 'string' && typeof value !== 'string') {
        errors.push(`Field "${key}" harus bertipe string`);
      }
      if (expectedType === 'number' && typeof value !== 'number') {
        errors.push(`Field "${key}" harus bertipe number`);
      }
      if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push(`Field "${key}" harus berupa array`);
      }

      const enumValues = (schema as any).enum;
      if (enumValues && Array.isArray(enumValues) && !enumValues.includes(value)) {
        errors.push(
          `Field "${key}" harus salah satu dari: ${enumValues.join(', ')}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async executeTool(
    name: string,
    args: Record<string, any>,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        status: 'error',
        data: {},
        preview: `Tool "${name}" tidak dikenali`,
        metadata: {
          toolName: name,
          displayName: name,
          executionTime: 0,
        },
        error: { code: 'TOOL_NOT_FOUND', message: `Tool "${name}" not recognized` },
      };
    }

    const parameters = tool.definition.function.parameters;
    const validation = this.validateArgs(args, parameters);
    if (!validation.valid) {
      return {
        status: 'error',
        data: { receivedArgs: args },
        preview: `Input tidak valid: ${validation.errors.join('; ')}`,
        metadata: {
          toolName: name,
          displayName: tool.capability.displayName,
          executionTime: 0,
        },
        error: {
          code: 'INVALID_ARGS',
          message: validation.errors.join('; '),
        },
      };
    }

    this.logger.log(`Executing tool "${name}" (timeout: ${tool.timeoutMs}ms)`);
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        () => Promise.resolve(tool.handler(args)),
        tool.timeoutMs,
      );
      result.metadata.executionTime = Date.now() - startTime;
      return result;
    } catch (e) {
      const isTimeout = e.message?.includes('timeout');
      return {
        status: 'error',
        data: {},
        preview: isTimeout
          ? `Tool "${name}" timeout setelah ${tool.timeoutMs}ms`
          : `Tool "${name}" gagal: ${e.message}`,
        metadata: {
          toolName: name,
          displayName: tool.capability.displayName,
          executionTime: Date.now() - startTime,
        },
        error: {
          code: isTimeout ? 'TOOL_TIMEOUT' : 'EXECUTION_FAILED',
          message: e.message,
        },
      };
    }
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async handleGenerateExport(
    args: Record<string, any>,
  ): Promise<ToolResult> {
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
