import { Injectable, Logger } from '@nestjs/common';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { EnterpriseCalculatorTool } from './services/enterprise-calculator.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    private readonly textExtractorTool: TextExtractorTool,
    private readonly calculatorTool: EnterpriseCalculatorTool,
    private readonly documentGeneratorTool: DocumentGeneratorTool,
  ) {}

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'extract_structured_data',
          description:
            'Mengekstrak data terstruktur dari teks mentah apapun — invoice, pesanan, rekap, laporan, inventaris, struk, dsb. Menghasilkan output terstruktur dengan judul, total per kategori, dan plain text output.',
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
      {
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
      {
        type: 'function',
        function: {
          name: 'generate_export',
          description:
            'Mengonversi data terstruktur menjadi file siap download (Excel, CSV).',
          parameters: {
            type: 'object',
            properties: {
              sheetName: { type: 'string' },
              rows: { type: 'array' },
              filename: { type: 'string' },
            },
            required: ['rows'],
          },
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    this.logger.log(`Executing tool "${name}"`);

    switch (name) {
      case 'extract_structured_data':
        return this.textExtractorTool.extractStructuredData(
          args.rawText,
          args.title || '',
        );

      case 'calculate':
        return this.calculatorTool.calculateFinancials(
          args.items || [],
          args.taxPercent || 0,
          args.discountPercent || 0,
        );

      case 'generate_export':
        return this.documentGeneratorTool.generateExcel(
          args.sheetName || 'Data',
          args.rows || [],
          args.filename || 'export.xlsx',
        );

      default:
        throw new Error(`Tool "${name}" not recognized`);
    }
  }
}
