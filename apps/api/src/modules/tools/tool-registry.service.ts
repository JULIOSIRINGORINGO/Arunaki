import { Injectable, Logger } from '@nestjs/common';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { EnterpriseCalculatorTool } from './services/enterprise-calculator.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';
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
  ) {
    this.registerBuiltinTools();
  }

  private registerBuiltinTools(): void {
    this.register('extract_structured_data', {
      handler: (args) =>
        this.textExtractorTool.extractStructuredData(
          args.rawText,
          args.title || '',
        ),
      definition: {
        type: 'function',
        function: {
          name: 'extract_structured_data',
          description:
            'Mengekstrak data terstruktur dari teks mentah — invoice, pesanan, rekap, laporan, inventaris, struk. Menghasilkan data terstruktur dengan item, angka, dan ringkasan.',
          parameters: {
            type: 'object',
            properties: {
              rawText: {
                type: 'string',
                description: 'Teks mentah dari pengguna (invoice, pesanan, laporan, dll)',
              },
              title: {
                type: 'string',
                description: 'Judul data (opsional)',
              },
            },
            required: ['rawText'],
          },
        },
      },
      capability: {
        name: 'extract_structured_data',
        displayName: 'Ekstraksi Data',
        description: 'Mengekstrak data terstruktur dari teks mentah',
        tags: ['extract', 'data', 'invoice', 'order', 'text', 'nlp'],
        inputSchema: { rawText: 'string', title: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      timeoutMs: 5000,
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
