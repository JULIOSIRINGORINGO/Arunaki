import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageOcrTool {
  private readonly logger = new Logger(ImageOcrTool.name);

  async recognizeText(
    filePath: string,
    language?: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    if (!filePath || filePath.trim().length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Image path cannot be empty',
        metadata: {
          toolName: 'image_ocr',
          displayName: 'Image OCR',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_PATH', message: 'File path required' },
      };
    }

    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return {
        status: 'error',
        data: {},
        preview: `File not found: ${resolvedPath}`,
        metadata: {
          toolName: 'image_ocr',
          displayName: 'Image OCR',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'FILE_NOT_FOUND',
          message: `File not found: ${resolvedPath}`,
        },
      };
    }

    try {
      const Tesseract = await import('tesseract.js');

      const lang = language || 'eng';

      this.logger.log(`Processing OCR: ${resolvedPath} (lang: ${lang})`);

      const { data } = await Tesseract.recognize(resolvedPath, lang);

      const text = data.text.trim();
      const confidence = data.confidence;

      return {
        status: 'success',
        data: {
          text,
          confidence,
          filePath: resolvedPath,
          filename: path.basename(resolvedPath),
          language: lang,
        },
        preview: text.length > 300 ? text.substring(0, 300) + '...' : text,
        metadata: {
          toolName: 'image_ocr',
          displayName: 'Image OCR',
          executionTime: Date.now() - startTime,
          confidence,
        },
      };
    } catch (e: any) {
      this.logger.error(`OCR failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `OCR failed: ${e.message}`,
        metadata: {
          toolName: 'image_ocr',
          displayName: 'Image OCR',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'OCR_FAILED', message: e.message },
      };
    }
  }
}
