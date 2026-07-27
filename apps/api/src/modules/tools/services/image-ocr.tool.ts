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
        preview: 'Path gambar tidak boleh kosong',
        metadata: {
          toolName: 'image_ocr',
          displayName: 'OCR Gambar',
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
        preview: `File tidak ditemukan: ${resolvedPath}`,
        metadata: {
          toolName: 'image_ocr',
          displayName: 'OCR Gambar',
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

      const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;

      return {
        status: 'success',
        data: {
          text,
          confidence,
          language: lang,
        },
        preview: preview || 'Tidak ada teks terdeteksi',
        metadata: {
          toolName: 'image_ocr',
          displayName: 'OCR Gambar',
          executionTime: Date.now() - startTime,
          format: 'text',
          filename: path.basename(resolvedPath),
        },
      };
    } catch (e) {
      this.logger.error(`OCR failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `OCR gagal: ${e.message}`,
        metadata: {
          toolName: 'image_ocr',
          displayName: 'OCR Gambar',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'OCR_FAILED', message: e.message },
      };
    }
  }
}
