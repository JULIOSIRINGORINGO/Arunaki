import { Injectable, Logger } from '@nestjs/common';
import * as xlsx from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
} from 'docx';
import PptxGenJS from 'pptxgenjs';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class DocumentGeneratorTool {
  private readonly logger = new Logger(DocumentGeneratorTool.name);

  generateExcel(
    sheetName: string,
    rows: Array<Record<string, any>>,
    filename: string = 'export.xlsx',
  ): ToolResult {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

    try {
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const contentBase64 = buffer.toString('base64');

      const preview = rows.length > 0
        ? `${sheetName}: ${rows.length} baris data\nKolom: ${Object.keys(rows[0]).join(', ')}`
        : `${sheetName}: 0 baris data`;

      return {
        status: 'success',
        data: { sheetName, rowCount: rows.length, columns: rows.length > 0 ? Object.keys(rows[0]) : [] },
        preview,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentBase64,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate Excel: ${e.message}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
        },
        error: { code: 'XLSX_FAILED', message: e.message },
      };
    }
  }

  generateCsv(
    rows: Array<Record<string, any>>,
    filename: string = 'export.csv',
  ): ToolResult {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

    try {
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const csvContent = xlsx.utils.sheet_to_csv(worksheet);
      const contentBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');

      const preview = rows.length > 0
        ? `CSV: ${rows.length} baris data\nKolom: ${Object.keys(rows[0]).join(', ')}`
        : `CSV: 0 baris data`;

      return {
        status: 'success',
        data: { rowCount: rows.length, columns: rows.length > 0 ? Object.keys(rows[0]) : [] },
        preview,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'csv',
          filename: safeFilename,
          mimeType: 'text/csv',
          contentBase64,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate CSV: ${e.message}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'csv',
          filename: safeFilename,
        },
        error: { code: 'CSV_FAILED', message: e.message },
      };
    }
  }

  async generatePdf(
    title: string,
    content: string,
    filename: string = 'document.pdf',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

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
            const testLine = currentLine
              ? `${currentLine} ${word}`
              : word;
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

      return {
        status: 'success',
        data: { title, pageCount, size: pdfBytes.length },
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
    } catch (e) {
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

  async generateDocx(
    title: string,
    content: string,
    filename: string = 'document.docx',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

    try {
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const children: any[] = [];

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: title, bold: true, size: 36 }),
          ],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
      );

      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.replace(/^#\s*/, ''),
                  bold: true,
                  size: 32,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 },
            }),
          );
        } else if (line.startsWith('## ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.replace(/^##\s*/, ''),
                  bold: true,
                  size: 26,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 150, after: 80 },
            }),
          );
        } else if (line.startsWith('|') && line.includes('|')) {
          const cells = line
            .split('|')
            .filter((c) => c.trim().length > 0)
            .map((c) => c.trim());
          if (!cells.every((c) => /^[-:]+$/.test(c))) {
            const tableRow = new TableRow({
              children: cells.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: cell, size: 20 }),
                        ],
                      }),
                    ],
                    width: {
                      size: Math.floor(100 / cells.length),
                      type: WidthType.PERCENTAGE,
                    },
                  }),
              ),
            });
            children.push(
              new Table({
                rows: [tableRow],
                width: { size: 100, type: WidthType.PERCENTAGE },
              }),
            );
          }
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${line.replace(/^[-*]\s*/, '')}`,
                  size: 22,
                }),
              ],
              spacing: { before: 40, after: 40 },
            }),
          );
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line, size: 22 })],
              spacing: { before: 40, after: 40 },
            }),
          );
        }
      }

      const doc = new Document({
        sections: [{ children }],
      });

      const buffer = await Packer.toBuffer(doc);
      const contentBase64 = buffer.toString('base64');

      return {
        status: 'success',
        data: { title, paragraphCount: children.length, size: buffer.length },
        preview: `${title} — ${children.length} blok konten, ${this.formatBytes(buffer.length)}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'docx',
          filename: safeFilename,
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentBase64,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate DOCX: ${e.message}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'docx',
          filename: safeFilename,
        },
        error: { code: 'DOCX_FAILED', message: e.message },
      };
    }
  }

  async generatePptx(
    title: string,
    slides: Array<{ heading?: string; content: string }>,
    filename: string = 'presentation.pptx',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.pptx')
      ? filename
      : `${filename}.pptx`;

    try {
      const pptx = new PptxGenJS();
      pptx.author = 'Arunaki AI';
      pptx.title = title;

      const titleSlide = pptx.addSlide();
      titleSlide.addText(title, {
        x: '10%',
        y: '40%',
        w: '80%',
        fontSize: 32,
        bold: true,
        align: 'center',
        color: '111827',
      });
      titleSlide.addText('Dibuat oleh Arunaki AI', {
        x: '10%',
        y: '60%',
        w: '80%',
        fontSize: 14,
        align: 'center',
        color: '6B7280',
      });

      for (const slide of slides) {
        const s = pptx.addSlide();

        if (slide.heading) {
          s.addText(slide.heading, {
            x: '5%',
            y: '5%',
            w: '90%',
            fontSize: 24,
            bold: true,
            color: '111827',
          });
        }

        const bulletLines = slide.content
          .split('\n')
          .filter((l) => l.trim().length > 0);
        const bulletItems = bulletLines.map((line) => ({
          text: line
            .replace(/^[-*•]\s*/, '')
            .replace(/^\d+[.)]\s*/, ''),
          options: { fontSize: 16, color: '374151', bullet: true },
        }));

        s.addText(bulletItems, {
          x: '5%',
          y: slide.heading ? '25%' : '10%',
          w: '90%',
          h: '70%',
          valign: 'top',
          lineSpacing: 24,
        });
      }

      const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
      const contentBase64 = buffer.toString('base64');

      return {
        status: 'success',
        data: { title, slideCount: slides.length + 1, size: buffer.length },
        preview: `${title} — ${slides.length + 1} slide, ${this.formatBytes(buffer.length)}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'pptx',
          filename: safeFilename,
          mimeType:
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          contentBase64,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate PPTX: ${e.message}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'pptx',
          filename: safeFilename,
        },
        error: { code: 'PPTX_FAILED', message: e.message },
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
