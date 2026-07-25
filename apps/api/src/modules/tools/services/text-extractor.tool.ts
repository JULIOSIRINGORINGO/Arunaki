import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { detectFormat } from './extractors/format-detector.js';
import {
  parseInvoice,
  parseReceipt,
  parsePurchaseOrder,
  parseGeneric,
  ParsedDocument,
} from './extractors/rule-parsers.js';
import {
  normalizeDocument,
  formatAsPreview,
} from './extractors/validator-normalizer.js';

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
      const inputText = title ? `${title}\n${rawText}` : rawText;
      const detected = detectFormat(inputText);

      this.logger.log(
        `Format detected: ${detected.type} (confidence: ${detected.confidence})`,
      );

      let parsed: ParsedDocument;

      switch (detected.type) {
        case 'invoice':
          parsed = parseInvoice(inputText);
          break;
        case 'receipt':
          parsed = parseReceipt(inputText);
          break;
        case 'purchase_order':
          parsed = parsePurchaseOrder(inputText);
          break;
        default:
          parsed = parseGeneric(inputText);
          break;
      }

      if (title && !parsed.title) {
        parsed.title = title;
      }

      const normalized = normalizeDocument(parsed);
      const preview = formatAsPreview(normalized);

      return {
        status: normalized.validation.valid ? 'success' : 'partial',
        data: {
          format: normalized.format,
          title: normalized.title,
          items: normalized.items,
          summary: normalized.summary,
          metadata: normalized.metadata,
          detectedFormat: {
            type: detected.type,
            confidence: detected.confidence,
            signals: detected.signals,
          },
          validation: normalized.validation,
        },
        preview,
        metadata: {
          toolName: 'extract_structured_data',
          displayName: 'Ekstraksi Data',
          executionTime: Date.now() - startTime,
        },
        ...(normalized.validation.valid
          ? {}
          : {
              error: {
                code: 'VALIDATION_PARTIAL',
                message: `Ekstraksi sebagian: ${normalized.validation.errors.join('; ')}`,
              },
            }),
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
}
