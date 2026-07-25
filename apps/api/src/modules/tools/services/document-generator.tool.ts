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

export interface DocumentExportResult {
  filename: string;
  format: 'pdf' | 'xlsx' | 'csv' | 'docx' | 'pptx';
  contentBase64: string;
  mimeType: string;
}

@Injectable()
export class DocumentGeneratorTool {
  private readonly logger = new Logger(DocumentGeneratorTool.name);

  generateExcel(
    sheetName: string,
    rows: Array<Record<string, any>>,
    filename: string = 'export.xlsx',
  ): DocumentExportResult {
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const contentBase64 = buffer.toString('base64');

    return {
      filename: filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
      format: 'xlsx',
      contentBase64,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  generateCsv(
    rows: Array<Record<string, any>>,
    filename: string = 'export.csv',
  ): DocumentExportResult {
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    const contentBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');

    return {
      filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
      format: 'csv',
      contentBase64,
      mimeType: 'text/csv',
    };
  }

  async generatePdf(
    title: string,
    content: string,
    filename: string = 'document.pdf',
  ): Promise<DocumentExportResult> {
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
        const text = line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '• ');
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

    return {
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      format: 'pdf',
      contentBase64,
      mimeType: 'application/pdf',
    };
  }

  async generateDocx(
    title: string,
    content: string,
    filename: string = 'document.docx',
  ): Promise<DocumentExportResult> {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const children: any[] = [];

    children.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 36 })],
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
              new TextRun({ text: line.replace(/^#\s*/, ''), bold: true, size: 32 }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
          }),
        );
      } else if (line.startsWith('## ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: line.replace(/^##\s*/, ''), bold: true, size: 26 }),
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
                      children: [new TextRun({ text: cell, size: 20 })],
                    }),
                  ],
                  width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
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
              new TextRun({ text: `• ${line.replace(/^[-*]\s*/, '')}`, size: 22 }),
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
      filename: filename.endsWith('.docx') ? filename : `${filename}.docx`,
      format: 'docx',
      contentBase64,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  async generatePptx(
    title: string,
    slides: Array<{ heading?: string; content: string }>,
    filename: string = 'presentation.pptx',
  ): Promise<DocumentExportResult> {
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

      const lines = slide.content.split('\n').filter((l) => l.trim().length > 0);
      const bulletItems = lines.map((line) => ({
        text: line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, ''),
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

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    const contentBase64 = (buffer as Buffer).toString('base64');

    return {
      filename: filename.endsWith('.pptx') ? filename : `${filename}.pptx`,
      format: 'pptx',
      contentBase64,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
  }
}
