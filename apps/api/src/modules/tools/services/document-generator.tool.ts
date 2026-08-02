import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
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

export interface BusinessReportData {
  companyName: string;
  period: string;
  currency?: string;
  // RUG data
  revenue?: Array<{ category: string; amount: number }>;
  cogs?: Array<{ category: string; amount: number }>;
  operatingExpenses?: Array<{ category: string; amount: number }>;
  // Laba Rugi data
  incomeItems?: Array<{ category: string; amount: number }>;
  expenseItems?: Array<{ category: string; amount: number }>;
  // Neraca data
  assets?: Array<{ category: string; amount: number }>;
  liabilities?: Array<{ category: string; amount: number }>;
  equity?: Array<{ category: string; amount: number }>;
}

@Injectable()
export class DocumentGeneratorTool {
  private readonly logger = new Logger(DocumentGeneratorTool.name);

  generateExcel(
    sheetName: string,
    rows: Array<Record<string, any>>,
    filename: string = 'export.xlsx',
    outputPath?: string,
  ): ToolResult {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.xlsx')
      ? filename
      : `${filename}.xlsx`;

    try {
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const contentBase64 = buffer.toString('base64');

      // Write directly to disk if outputPath or filename is a file path
      const targetWritePath = outputPath || (filename.includes('/') || filename.includes('\\') ? filename : null);
      if (targetWritePath) {
        const resolvedTarget = path.resolve(targetWritePath);
        const parentDir = path.dirname(resolvedTarget);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedTarget, buffer);
        this.logger.log(`Wrote Excel file physically to disk: ${resolvedTarget}`);
      }

      const preview =
        rows.length > 0
          ? `${sheetName}: ${rows.length} baris data\nKolom: ${Object.keys(rows[0]).join(', ')}`
          : `${sheetName}: 0 baris data`;

      return {
        status: 'success',
        data: {
          sheetName,
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          writtenToDisk: !!targetWritePath,
          filePath: targetWritePath ? path.resolve(targetWritePath) : undefined,
        },
        preview,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentBase64,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate Excel: ${e.message}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EXCEL_GEN_FAILED', message: e.message },
      };
    }
  }

  generateCsv(
    rows: Array<Record<string, any>>,
    filename: string = 'export.csv',
    outputPath?: string,
  ): ToolResult {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.csv')
      ? filename
      : `${filename}.csv`;

    try {
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const csvContent = xlsx.utils.sheet_to_csv(worksheet);
      const contentBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');

      const targetWritePath = outputPath || (filename.includes('/') || filename.includes('\\') ? filename : null);
      if (targetWritePath) {
        const resolvedTarget = path.resolve(targetWritePath);
        const parentDir = path.dirname(resolvedTarget);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedTarget, csvContent, 'utf-8');
        this.logger.log(`Wrote CSV file physically to disk: ${resolvedTarget}`);
      }

      const preview =
        rows.length > 0
          ? `CSV: ${rows.length} baris data\nKolom: ${Object.keys(rows[0]).join(', ')}`
          : `CSV: 0 baris data`;

      return {
        status: 'success',
        data: {
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          writtenToDisk: !!targetWritePath,
          filePath: targetWritePath ? path.resolve(targetWritePath) : undefined,
        },
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

      const targetWritePath = outputPath || (filename.includes('/') || filename.includes('\\') ? filename : null);
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
    outputPath?: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.docx')
      ? filename
      : `${filename}.docx`;

    try {
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
                        children: [new TextRun({ text: cell, size: 20 })],
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

      const targetWritePath = outputPath || (filename.includes('/') || filename.includes('\\') ? filename : null);
      if (targetWritePath) {
        const resolvedTarget = path.resolve(targetWritePath);
        const parentDir = path.dirname(resolvedTarget);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedTarget, buffer);
        this.logger.log(`Wrote DOCX file physically to disk: ${resolvedTarget}`);
      }

      return {
        status: 'success',
        data: {
          title,
          paragraphCount: children.length,
          size: buffer.length,
          writtenToDisk: !!targetWritePath,
          filePath: targetWritePath ? path.resolve(targetWritePath) : undefined,
        },
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

  /**
   * Generate RUG (Rincian Usaha Gym) - Revenue & Cost Report
   */
  async generateRugReport(
    data: BusinessReportData,
    filename: string = 'rug-report.xlsx',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.xlsx')
      ? filename
      : `${filename}.xlsx`;

    try {
      const workbook = xlsx.utils.book_new();
      const currency = data.currency || 'IDR';

      const summaryRows: Array<Record<string, string | number>> = [
        {
          Laporan: 'Rincian Usaha Gym (RUG)',
          Periode: data.period,
          Perusahaan: data.companyName,
        },
        { Laporan: '', Periode: '', Perusahaan: '' },
        { Laporan: 'PENDAPATAN', Jumlah: '', Keterangan: '' },
      ];

      let totalRevenue = 0;

      if (data.revenue && data.revenue.length > 0) {
        for (const item of data.revenue) {
          totalRevenue += item.amount;
          summaryRows.push({
            Laporan: `  ${item.category}`,
            Jumlah: String(item.amount),
            Keterangan: currency,
          });
        }
        summaryRows.push({
          Laporan: 'Total Pendapatan',
          Jumlah: String(totalRevenue),
          Keterangan: currency,
        });
      }

      summaryRows.push({ Laporan: '', Periode: '', Perusahaan: '' });
      summaryRows.push({
        Laporan: 'HARGA POKOK PENJUALAN (HPP)',
        Jumlah: '',
        Keterangan: '',
      });

      let totalCogs = 0;
      if (data.cogs && data.cogs.length > 0) {
        for (const item of data.cogs) {
          totalCogs += item.amount;
          summaryRows.push({
            Laporan: `  ${item.category}`,
            Jumlah: String(item.amount),
            Keterangan: currency,
          });
        }
        summaryRows.push({
          Laporan: 'Total HPP',
          Jumlah: String(totalCogs),
          Keterangan: currency,
        });
      }

      summaryRows.push({ Laporan: '', Periode: '', Perusahaan: '' });
      summaryRows.push({
        Laporan: 'LABA KOTOR',
        Jumlah: String(totalRevenue - totalCogs),
        Keterangan: currency,
      });

      summaryRows.push({ Laporan: '', Periode: '', Perusahaan: '' });
      summaryRows.push({
        Laporan: 'BIAYA OPERASIONAL',
        Jumlah: '',
        Keterangan: '',
      });

      let totalOpEx = 0;
      if (data.operatingExpenses && data.operatingExpenses.length > 0) {
        for (const item of data.operatingExpenses) {
          totalOpEx += item.amount;
          summaryRows.push({
            Laporan: `  ${item.category}`,
            Jumlah: String(item.amount),
            Keterangan: currency,
          });
        }
        summaryRows.push({
          Laporan: 'Total Biaya Operasional',
          Jumlah: String(totalOpEx),
          Keterangan: currency,
        });
      }

      summaryRows.push({ Laporan: '', Periode: '', Perusahaan: '' });
      summaryRows.push({
        Laporan: 'LABA BERSIH',
        Jumlah: String(totalRevenue - totalCogs - totalOpEx),
        Keterangan: currency,
      });

      const summarySheet = xlsx.utils.json_to_sheet(summaryRows);
      xlsx.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan RUG');

      // Sheet 2: Detail Revenue
      if (data.revenue && data.revenue.length > 0) {
        const revenueRows = data.revenue.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        const revSheet = xlsx.utils.json_to_sheet(revenueRows);
        xlsx.utils.book_append_sheet(workbook, revSheet, 'Detail Pendapatan');
      }

      // Sheet 3: Detail COGS
      if (data.cogs && data.cogs.length > 0) {
        const cogsRows = data.cogs.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        const cogsSheet = xlsx.utils.json_to_sheet(cogsRows);
        xlsx.utils.book_append_sheet(workbook, cogsSheet, 'Detail HPP');
      }

      // Sheet 4: Detail Operating Expenses
      if (data.operatingExpenses && data.operatingExpenses.length > 0) {
        const opexRows = data.operatingExpenses.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        const opexSheet = xlsx.utils.json_to_sheet(opexRows);
        xlsx.utils.book_append_sheet(
          workbook,
          opexSheet,
          'Detail Biaya Operasional',
        );
      }

      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const contentBase64 = buffer.toString('base64');

      return {
        status: 'success',
        data: {
          companyName: data.companyName,
          period: data.period,
          totalRevenue,
          totalCogs,
          totalOpEx,
          netIncome: totalRevenue - totalCogs - totalOpEx,
        },
        preview: `RUG Report: ${data.companyName} - ${data.period} | Laba Bersih: ${this.formatCurrency(totalRevenue - totalCogs - totalOpEx, currency)}`,
        metadata: {
          toolName: 'generate_business_report',
          displayName: 'Laporan Bisnis (RUG)',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentBase64,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate RUG: ${e.message}`,
        metadata: {
          toolName: 'generate_business_report',
          displayName: 'Laporan Bisnis (RUG)',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
        },
        error: { code: 'RUG_FAILED', message: e.message },
      };
    }
  }

  /**
   * Generate Laba Rugi (Profit & Loss) Report
   */
  async generateLabaRugiReport(
    data: BusinessReportData,
    filename: string = 'laba-rugi-report.xlsx',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.xlsx')
      ? filename
      : `${filename}.xlsx`;

    try {
      const workbook = xlsx.utils.book_new();
      const currency = data.currency || 'IDR';

      const rows: Array<Record<string, string | number>> = [
        { 'Laporan Laba Rugi': data.companyName, Periode: data.period, '': '' },
        { 'Laporan Laba Rugi': '', Periode: '', '': '' },
        { 'Laporan Laba Rugi': 'PENDAPATAN', Jumlah: '', 'Mata Uang': '' },
      ];

      let totalIncome = 0;
      if (data.incomeItems) {
        for (const item of data.incomeItems) {
          rows.push({
            'Laporan Laba Rugi': `  ${item.category}`,
            Jumlah: String(item.amount),
            'Mata Uang': currency,
          });
          totalIncome += item.amount;
        }
      }
      rows.push({
        'Laporan Laba Rugi': 'Total Pendapatan',
        Jumlah: String(totalIncome),
        'Mata Uang': currency,
      });

      rows.push({ 'Laporan Laba Rugi': '', Periode: '', '': '' });
      rows.push({
        'Laporan Laba Rugi': 'BEBAN/BIAYA',
        Jumlah: '',
        'Mata Uang': '',
      });

      let totalExpense = 0;
      if (data.expenseItems) {
        for (const item of data.expenseItems) {
          rows.push({
            'Laporan Laba Rugi': `  ${item.category}`,
            Jumlah: String(item.amount),
            'Mata Uang': currency,
          });
          totalExpense += item.amount;
        }
      }
      rows.push({
        'Laporan Laba Rugi': 'Total Beban',
        Jumlah: String(totalExpense),
        'Mata Uang': currency,
      });

      rows.push({ 'Laporan Laba Rugi': '', Periode: '', '': '' });
      const netProfit = totalIncome - totalExpense;
      rows.push({
        'Laporan Laba Rugi': netProfit >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH',
        Jumlah: String(Math.abs(netProfit)),
        'Mata Uang': currency,
      });

      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, 'Laba Rugi');

      // Detail sheets
      if (data.incomeItems && data.incomeItems.length > 0) {
        const incRows = data.incomeItems.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        xlsx.utils.book_append_sheet(
          workbook,
          xlsx.utils.json_to_sheet(incRows),
          'Detail Pendapatan',
        );
      }

      if (data.expenseItems && data.expenseItems.length > 0) {
        const expRows = data.expenseItems.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        xlsx.utils.book_append_sheet(
          workbook,
          xlsx.utils.json_to_sheet(expRows),
          'Detail Beban',
        );
      }

      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const contentBase64 = buffer.toString('base64');

      return {
        status: 'success',
        data: {
          companyName: data.companyName,
          period: data.period,
          totalIncome,
          totalExpense,
          netProfit,
        },
        preview: `Laba Rugi: ${data.companyName} - ${data.period} | ${netProfit >= 0 ? 'Laba' : 'Rugi'}: ${this.formatCurrency(Math.abs(netProfit), currency)}`,
        metadata: {
          toolName: 'generate_business_report',
          displayName: 'Laporan Laba Rugi',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentBase64,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate Laba Rugi: ${e.message}`,
        metadata: {
          toolName: 'generate_business_report',
          displayName: 'Laporan Laba Rugi',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
        },
        error: { code: 'LABA_RUGI_FAILED', message: e.message },
      };
    }
  }

  /**
   * Generate Neraca (Balance Sheet) Report
   */
  async generateNeracaReport(
    data: BusinessReportData,
    filename: string = 'neraca-report.xlsx',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.xlsx')
      ? filename
      : `${filename}.xlsx`;

    try {
      const workbook = xlsx.utils.book_new();
      const currency = data.currency || 'IDR';

      const rows: Array<Record<string, string | number>> = [
        { Neraca: data.companyName, 'Per Tanggal': data.period, '': '' },
        { Neraca: '', 'Per Tanggal': '', '': '' },
        { Neraca: 'ASET', Jumlah: '', 'Mata Uang': '' },
      ];

      let totalAssets = 0;
      if (data.assets) {
        for (const item of data.assets) {
          rows.push({
            Neraca: `  ${item.category}`,
            Jumlah: String(item.amount),
            'Mata Uang': currency,
          });
          totalAssets += item.amount;
        }
      }
      rows.push({
        Neraca: 'Total Aset',
        Jumlah: String(totalAssets),
        'Mata Uang': currency,
      });

      rows.push({ Neraca: '', 'Per Tanggal': '', '': '' });
      rows.push({ Neraca: 'KEWAJIBAN', Jumlah: '', 'Mata Uang': '' });

      let totalLiabilities = 0;
      if (data.liabilities) {
        for (const item of data.liabilities) {
          rows.push({
            Neraca: `  ${item.category}`,
            Jumlah: String(item.amount),
            'Mata Uang': currency,
          });
          totalLiabilities += item.amount;
        }
      }
      rows.push({
        Neraca: 'Total Kewajiban',
        Jumlah: String(totalLiabilities),
        'Mata Uang': currency,
      });

      rows.push({ Neraca: '', 'Per Tanggal': '', '': '' });
      rows.push({ Neraca: 'EKUITAS', Jumlah: '', 'Mata Uang': '' });

      let totalEquity = 0;
      if (data.equity) {
        for (const item of data.equity) {
          rows.push({
            Neraca: `  ${item.category}`,
            Jumlah: String(item.amount),
            'Mata Uang': currency,
          });
          totalEquity += item.amount;
        }
      }
      rows.push({
        Neraca: 'Total Ekuitas',
        Jumlah: String(totalEquity),
        'Mata Uang': currency,
      });

      rows.push({ Neraca: '', 'Per Tanggal': '', '': '' });
      rows.push({
        Neraca: 'TOTAL KEWAJIBAN & EKUITAS',
        Jumlah: String(totalLiabilities + totalEquity),
        'Mata Uang': currency,
      });

      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, 'Neraca');

      // Detail sheets
      if (data.assets && data.assets.length > 0) {
        const assetRows = data.assets.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        xlsx.utils.book_append_sheet(
          workbook,
          xlsx.utils.json_to_sheet(assetRows),
          'Detail Aset',
        );
      }

      if (data.liabilities && data.liabilities.length > 0) {
        const liabRows = data.liabilities.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        xlsx.utils.book_append_sheet(
          workbook,
          xlsx.utils.json_to_sheet(liabRows),
          'Detail Kewajiban',
        );
      }

      if (data.equity && data.equity.length > 0) {
        const eqRows = data.equity.map((r, i) => ({
          No: i + 1,
          Kategori: r.category,
          Jumlah: r.amount,
          Mata_Uang: currency,
        }));
        xlsx.utils.book_append_sheet(
          workbook,
          xlsx.utils.json_to_sheet(eqRows),
          'Detail Ekuitas',
        );
      }

      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const contentBase64 = buffer.toString('base64');

      const balanced = totalAssets === totalLiabilities + totalEquity;

      return {
        status: 'success',
        data: {
          companyName: data.companyName,
          period: data.period,
          totalAssets,
          totalLiabilities,
          totalEquity,
          balanced,
        },
        preview: `Neraca: ${data.companyName} - ${data.period} | Aset: ${this.formatCurrency(totalAssets, currency)} | Kewajiban+Ekuitas: ${this.formatCurrency(totalLiabilities + totalEquity, currency)} ${balanced ? '✓ Seimbang' : '⚠ Tidak Seimbang'}`,
        metadata: {
          toolName: 'generate_business_report',
          displayName: 'Laporan Neraca',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentBase64,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate Neraca: ${e.message}`,
        metadata: {
          toolName: 'generate_business_report',
          displayName: 'Laporan Neraca',
          executionTime: Date.now() - startTime,
          format: 'xlsx',
          filename: safeFilename,
        },
        error: { code: 'NERACA_FAILED', message: e.message },
      };
    }
  }

  /**
   * Generate PDF version of business report using existing PDF generator
   */
  async generateBusinessReportPdf(
    data: BusinessReportData,
    reportType: 'rug' | 'laba-rugi' | 'neraca',
    filename: string = 'business-report.pdf',
  ): Promise<ToolResult> {
    const currency = data.currency || 'IDR';
    let content = '';

    if (reportType === 'rug') {
      content = this.formatRugContent(data, currency);
    } else if (reportType === 'laba-rugi') {
      content = this.formatLabaRugiContent(data, currency);
    } else if (reportType === 'neraca') {
      content = this.formatNeracaContent(data, currency);
    }

    const titles: Record<string, string> = {
      rug: 'Laporan Rincian Usaha Gym (RUG)',
      'laba-rugi': 'Laporan Laba Rugi',
      neraca: 'Laporan Neraca (Balance Sheet)',
    };

    return this.generatePdf(
      `${titles[reportType]} - ${data.companyName}`,
      content,
      filename,
    );
  }

  private formatRugContent(data: BusinessReportData, currency: string): string {
    let content = `${data.companyName}\nPeriode: ${data.period}\n\n`;

    content += `## PENDAPATAN\n`;
    let totalRevenue = 0;
    if (data.revenue) {
      for (const item of data.revenue) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalRevenue += item.amount;
      }
    }
    content += `**Total Pendapatan: ${this.formatCurrency(totalRevenue, currency)}**\n\n`;

    content += `## HARGA POKOK PENJUALAN (HPP)\n`;
    let totalCogs = 0;
    if (data.cogs) {
      for (const item of data.cogs) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalCogs += item.amount;
      }
    }
    content += `**Total HPP: ${this.formatCurrency(totalCogs, currency)}**\n\n`;

    content += `## LABA KOTOR\n`;
    content += `**${this.formatCurrency(totalRevenue - totalCogs, currency)}**\n\n`;

    content += `## BIAYA OPERASIONAL\n`;
    let totalOpEx = 0;
    if (data.operatingExpenses) {
      for (const item of data.operatingExpenses) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalOpEx += item.amount;
      }
    }
    content += `**Total Biaya Operasional: ${this.formatCurrency(totalOpEx, currency)}**\n\n`;

    content += `## LABA BERSIH\n`;
    content += `**${this.formatCurrency(totalRevenue - totalCogs - totalOpEx, currency)}**\n`;

    return content;
  }

  private formatLabaRugiContent(
    data: BusinessReportData,
    currency: string,
  ): string {
    let content = `${data.companyName}\nPeriode: ${data.period}\n\n`;

    content += `## PENDAPATAN\n`;
    let totalIncome = 0;
    if (data.incomeItems) {
      for (const item of data.incomeItems) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalIncome += item.amount;
      }
    }
    content += `**Total Pendapatan: ${this.formatCurrency(totalIncome, currency)}**\n\n`;

    content += `## BEBAN/BIAYA\n`;
    let totalExpense = 0;
    if (data.expenseItems) {
      for (const item of data.expenseItems) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalExpense += item.amount;
      }
    }
    content += `**Total Beban: ${this.formatCurrency(totalExpense, currency)}**\n\n`;

    const netProfit = totalIncome - totalExpense;
    content += `## ${netProfit >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}\n`;
    content += `**${this.formatCurrency(Math.abs(netProfit), currency)}**\n`;

    return content;
  }

  private formatNeracaContent(
    data: BusinessReportData,
    currency: string,
  ): string {
    let content = `${data.companyName}\nPer Tanggal: ${data.period}\n\n`;

    content += `## ASET\n`;
    let totalAssets = 0;
    if (data.assets) {
      for (const item of data.assets) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalAssets += item.amount;
      }
    }
    content += `**Total Aset: ${this.formatCurrency(totalAssets, currency)}**\n\n`;

    content += `## KEWAJIBAN\n`;
    let totalLiabilities = 0;
    if (data.liabilities) {
      for (const item of data.liabilities) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalLiabilities += item.amount;
      }
    }
    content += `**Total Kewajiban: ${this.formatCurrency(totalLiabilities, currency)}**\n\n`;

    content += `## EKUITAS\n`;
    let totalEquity = 0;
    if (data.equity) {
      for (const item of data.equity) {
        content += `- ${item.category}: ${this.formatCurrency(item.amount, currency)}\n`;
        totalEquity += item.amount;
      }
    }
    content += `**Total Ekuitas: ${this.formatCurrency(totalEquity, currency)}**\n\n`;

    content += `## TOTAL KEWAJIBAN & EKUITAS\n`;
    content += `**${this.formatCurrency(totalLiabilities + totalEquity, currency)}**\n`;

    const balanced = totalAssets === totalLiabilities + totalEquity;
    content += balanced ? '\n✓ Neraca seimbang' : '\n⚠ Neraca tidak seimbang';

    return content;
  }

  private formatCurrency(amount: number, currency: string): string {
    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));

    const symbols: Record<string, string> = {
      IDR: 'Rp ',
      USD: '$ ',
      EUR: '€ ',
      SGD: 'S$ ',
      MYR: 'RM ',
    };

    const symbol = symbols[currency] || `${currency} `;
    return `${symbol}${formatted}`;
  }
}
