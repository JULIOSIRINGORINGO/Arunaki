import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class TextExtractorTool {
  private readonly logger = new Logger(TextExtractorTool.name);

  extractStructuredData(rawText: string, title: string = ''): ToolResult {
    const startTime = Date.now();

    if (!rawText || !rawText.trim()) {
      return {
        status: 'error',
        data: {},
        preview: title ? title : 'Teks kosong — tidak ada data yang bisa diekstrak',
        metadata: {
          toolName: 'extract_structured_data',
          displayName: 'Ekstraksi Data',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_INPUT', message: 'Input teks kosong' },
      };
    }

    try {
      const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
      const extractedItems: Array<{
        line: number;
        text: string;
        numbers: number[];
      }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const numbers = this.extractNumbers(line);
        if (numbers.length > 0 || line.length > 3) {
          extractedItems.push({ line: i + 1, text: line, numbers });
        }
      }

      const totalNumbers = extractedItems.reduce(
        (sum, item) => sum + item.numbers.length,
        0,
      );

      const preview = extractedItems.length > 0
        ? extractedItems
            .map((item) => {
              const nums =
                item.numbers.length > 0
                  ? ` [${item.numbers.join(', ')}]`
                  : '';
              return `${item.text}${nums}`;
            })
            .join('\n')
        : `${title || 'Data'} — ${lines.length} baris teks ditemukan`;

      return {
        status: 'success',
        data: {
          title,
          items: extractedItems,
          totalLines: lines.length,
          totalNumbers,
        },
        preview,
        metadata: {
          toolName: 'extract_structured_data',
          displayName: 'Ekstraksi Data',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal mengekstrak data: ${e.message}`,
        metadata: {
          toolName: 'extract_structured_data',
          displayName: 'Ekstraksi Data',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EXTRACTION_FAILED', message: e.message },
      };
    }
  }

  private extractNumbers(text: string): number[] {
    const matches = text.match(
      /[\d.,]+(?:\.\d{3})*(?:,\d{1,2})?/g,
    );
    if (!matches) return [];

    return matches
      .map((m) => {
        const cleaned = m.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      })
      .filter((n): n is number => n !== null);
  }
}
