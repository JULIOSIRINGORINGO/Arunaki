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
                description: 'Tipe knowledge (custom, garment, restaurant, finance, dll)',
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
