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
          name: 'parse_garment_order',
          description:
            'Mengekstrak data pesanan/rekap ukuran dari teks berantakan menjadi data terstruktur presisi (header, ukuran S-5XL, total pcs, dan daftar duplikat/anomali).',
          parameters: {
            type: 'object',
            properties: {
              rawText: {
                type: 'string',
                description: 'Teks acak pesanan dari pengguna',
              },
            },
            required: ['rawText'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate_financials',
          description:
            'Melakukan kalkulasi keuangan/stok presisi (subtotal, pajak, diskon, dan total akhir).',
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
          name: 'generate_excel_export',
          description:
            'Mengonversi tabel data menjadi file Excel (.xlsx) siap download.',
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
    this.logger.log(`Executing tool "${name}" with args: ${JSON.stringify(args)}`);

    switch (name) {
      case 'parse_garment_order':
        return this.textExtractorTool.parseGarmentOrder(args.rawText);

      case 'calculate_financials':
        return this.calculatorTool.calculateFinancials(
          args.items || [],
          args.taxPercent || 0,
          args.discountPercent || 0,
        );

      case 'generate_excel_export':
        return this.documentGeneratorTool.generateExcel(
          args.sheetName || 'Data',
          args.rows || [],
          args.filename || 'rekap.xlsx',
        );

      default:
        throw new Error(`Tool "${name}" not recognized`);
    }
  }
}
