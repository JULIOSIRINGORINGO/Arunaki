import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageOcrTool {
  private readonly logger = new Logger(ImageOcrTool.name);

  private resolveImagePath(imageSource: string): string | null {
    if (!imageSource) return null;
    const clean = imageSource.replace(/^@/, '').trim();
    if (!clean) return null;

    if (fs.existsSync(clean)) return path.resolve(clean);
    const absPath = path.resolve(clean);
    if (fs.existsSync(absPath)) return absPath;

    const candidateBases = [
      path.join(process.cwd(), 'workspace-data'),
      path.join(process.cwd(), 'apps', 'api', 'workspace-data'),
      path.join(process.cwd(), '..', 'workspace-data'),
      path.join(process.cwd(), '..', 'apps', 'api', 'workspace-data'),
    ];

    for (const baseUploads of candidateBases) {
      if (fs.existsSync(baseUploads)) {
        try {
          const wsDirs = fs.readdirSync(baseUploads);
          for (const ws of wsDirs) {
            const candidate = path.join(baseUploads, ws, 'uploads', path.basename(clean));
            if (fs.existsSync(candidate)) return candidate;
          }
        } catch {}
      }
    }
    return null;
  }

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

    const resolvedPath = this.resolveImagePath(filePath);

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return {
        status: 'error',
        data: {},
        preview: `File not found: ${filePath}`,
        metadata: {
          toolName: 'image_ocr',
          displayName: 'Image OCR',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'FILE_NOT_FOUND',
          message: `File not found: ${filePath}`,
        },
      };
    }

    try {
      const tesseractMod = await import('tesseract.js');
      const Tesseract: any =
        tesseractMod.default && typeof (tesseractMod.default as any).recognize === 'function'
          ? tesseractMod.default
          : (tesseractMod as any).recognize
            ? tesseractMod
            : (tesseractMod.default as any)?.default || tesseractMod.default || tesseractMod;

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
