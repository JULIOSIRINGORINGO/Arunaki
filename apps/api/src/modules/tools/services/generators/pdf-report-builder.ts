import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ToolResult } from '../../interfaces/tool-result.interface.js';

@Injectable()
export class PdfReportBuilder {
  private readonly logger = new Logger(PdfReportBuilder.name);

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  async generatePdf(
    title: string,
    content: string,
    filename: string = 'document.pdf',
    outputPath?: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.pdf')
      ? filename
      : `${filename}.pdf`;

    try {
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const margin = 50;
      const maxWidth = width - margin * 2;

      let y = height - margin;

      page.drawText(title, {
        x: margin,
        y,
        size: 20,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 30;

      page.drawText('Dibuat oleh Arunaki AI', {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 20;

      const lines = content.split('\n');

      for (const line of lines) {
        if (y < margin + 20) {
          const newPage = pdfDoc.addPage();
          y = newPage.getSize().height - margin;
        }

        const currentPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];

        if (line.startsWith('## ')) {
          y -= 10;
          currentPage.drawText(line.replace(/^##\s*/, ''), {
            x: margin,
            y,
            size: 14,
            font: helveticaBold,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= 20;
        } else if (line.startsWith('# ')) {
          y -= 15;
          currentPage.drawText(line.replace(/^#\s*/, ''), {
            x: margin,
            y,
            size: 16,
            font: helveticaBold,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= 22;
        } else if (line.trim().length === 0) {
          y -= 10;
        } else {
          const text = line
            .replace(/^[-*•]\s*/, '')
            .replace(/^\d+[.)]\s*/, '• ');
          const words = text.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const textWidth = helvetica.widthOfTextAtSize(testLine, 11);

            if (textWidth > maxWidth) {
              currentPage.drawText(currentLine, {
                x: margin,
                y,
                size: 11,
                font: helvetica,
                color: rgb(0.2, 0.2, 0.2),
              });
              y -= 16;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }

          if (currentLine) {
            currentPage.drawText(currentLine, {
              x: margin,
              y,
              size: 11,
              font: helvetica,
              color: rgb(0.2, 0.2, 0.2),
            });
            y -= 16;
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const contentBase64 = Buffer.from(pdfBytes).toString('base64');
      const pageCount = pdfDoc.getPageCount();

      const targetWritePath = outputPath;
      if (targetWritePath) {
        const resolvedTarget = path.resolve(targetWritePath);
        const parentDir = path.dirname(resolvedTarget);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedTarget, pdfBytes);
        this.logger.log(`Wrote PDF file physically to disk: ${resolvedTarget}`);
      }

      return {
        status: 'success',
        data: {
          title,
          pageCount,
          size: pdfBytes.length,
          writtenToDisk: !!targetWritePath,
          filePath: targetWritePath ? path.resolve(targetWritePath) : undefined,
        },
        preview: `${title} — ${pageCount} halaman, ${this.formatBytes(pdfBytes.length)}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'pdf',
          filename: safeFilename,
          mimeType: 'application/pdf',
          contentBase64,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate PDF: ${e.message}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'pdf',
          filename: safeFilename,
        },
        error: { code: 'PDF_FAILED', message: e.message },
      };
    }
  }
}
