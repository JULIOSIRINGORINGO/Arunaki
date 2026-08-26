import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import * as fs from 'fs';
import * as path from 'path';

export interface PdfStampOptions {
  page?: number | 'last';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
}

@Injectable()
export class PdfStampTool {
  private readonly logger = new Logger(PdfStampTool.name);

  /**
   * Stamp an image (signature, company stamp, e-Materai) onto a PDF document.
   */
  async stampImage(
    pdfPath: string,
    imagePath: string,
    outputPath: string,
    options?: PdfStampOptions,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return {
        status: 'error',
        data: {},
        preview: `PDF file not found: ${pdfPath}`,
        metadata: {
          toolName: 'pdf_stamp_image',
          displayName: 'Stamp PDF',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'FILE_NOT_FOUND', message: `PDF file not found: ${pdfPath}` },
      };
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
      return {
        status: 'error',
        data: {},
        preview: `Stamp image not found: ${imagePath}`,
        metadata: {
          toolName: 'pdf_stamp_image',
          displayName: 'Stamp PDF',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'IMAGE_NOT_FOUND', message: `Stamp image not found: ${imagePath}` },
      };
    }

    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfBytes = fs.readFileSync(pdfPath);
      const imageBytes = fs.readFileSync(imagePath);
      const doc = await PDFDocument.load(pdfBytes);

      const totalPages = doc.getPageCount();
      if (totalPages === 0) {
        throw new Error('PDF document has no pages');
      }

      // Determine target page index (0-based)
      let targetIndex = totalPages - 1; // default: last page
      if (typeof options?.page === 'number') {
        const pNum = options.page - 1;
        if (pNum >= 0 && pNum < totalPages) {
          targetIndex = pNum;
        }
      }

      const page = doc.getPage(targetIndex);
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Embed image based on format (PNG / JPEG)
      const ext = path.extname(imagePath).toLowerCase();
      let embeddedImage: any;
      if (ext === '.png') {
        embeddedImage = await doc.embedPng(imageBytes);
      } else {
        embeddedImage = await doc.embedJpg(imageBytes);
      }

      const stampWidth = options?.width ?? 120;
      const stampHeight = options?.height ?? 60;
      const opacity = options?.opacity ?? 1.0;

      // Calculate coordinates
      let posX = options?.x ?? (pageWidth - stampWidth - 50);
      let posY = options?.y ?? 50; // 50pt from bottom

      if (options?.position) {
        switch (options.position) {
          case 'bottom-right':
            posX = pageWidth - stampWidth - 50;
            posY = 50;
            break;
          case 'bottom-left':
            posX = 50;
            posY = 50;
            break;
          case 'top-right':
            posX = pageWidth - stampWidth - 50;
            posY = pageHeight - stampHeight - 50;
            break;
          case 'top-left':
            posX = 50;
            posY = pageHeight - stampHeight - 50;
            break;
          case 'center':
            posX = (pageWidth - stampWidth) / 2;
            posY = (pageHeight - stampHeight) / 2;
            break;
        }
      }

      page.drawImage(embeddedImage, {
        x: posX,
        y: posY,
        width: stampWidth,
        height: stampHeight,
        opacity,
      });

      const modifiedBytes = await doc.save();
      const resolvedOutput = path.resolve(outputPath);
      const parentDir = path.dirname(resolvedOutput);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolvedOutput, modifiedBytes);

      return {
        status: 'success',
        data: {
          outputPath: resolvedOutput,
          targetPage: targetIndex + 1,
          totalPages,
          stampImage: path.basename(imagePath),
          position: { x: posX, y: posY, width: stampWidth, height: stampHeight },
          sizeBytes: modifiedBytes.length,
        },
        preview: `Stamped ${path.basename(imagePath)} on page ${targetIndex + 1}/${totalPages} → ${path.basename(resolvedOutput)}`,
        metadata: {
          toolName: 'pdf_stamp_image',
          displayName: 'Stamp PDF',
          executionTime: Date.now() - startTime,
          filename: path.basename(resolvedOutput),
        },
      };
    } catch (e: any) {
      this.logger.error(`PDF stamp failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `PDF stamp failed: ${e.message}`,
        metadata: {
          toolName: 'pdf_stamp_image',
          displayName: 'Stamp PDF',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'PDF_STAMP_FAILED', message: e.message },
      };
    }
  }
}
