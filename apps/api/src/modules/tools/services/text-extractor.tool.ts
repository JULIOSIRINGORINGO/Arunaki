import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import {
  ExtractedDataInput,
  normalizeExtractedData,
  formatAsPreview,
} from './extractors/validator-normalizer.js';

@Injectable()
export class TextExtractorTool {
  private readonly logger = new Logger(TextExtractorTool.name);

  extractStructuredData(input: ExtractedDataInput): ToolResult {
    const startTime = Date.now();

    if (!input || (!input.items || input.items.length === 0) && !input.title) {
      return {
        status: 'error',
        data: {},
        preview: 'Tidak ada data yang diberikan untuk diekstrak',
        metadata: {
          toolName: 'extract_structured_data',
          displayName: 'Ekstraksi Data',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_INPUT', message: 'Input kosong — LLM harus mengisi minimal title atau items' },
      };
    }

    try {
      this.logger.log(
        `Processing extracted data: type=${input.documentType || 'unknown'}, items=${input.items?.length || 0}`,
      );

      const normalized = normalizeExtractedData(input);
      const preview = formatAsPreview(normalized);

      return {
        status: normalized.validation.valid ? 'success' : 'partial',
        data: {
          format: normalized.format,
          title: normalized.title,
          items: normalized.items,
          summary: normalized.summary,
          metadata: normalized.metadata,
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
        preview: `Gagal memproses data: ${e.message}`,
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
