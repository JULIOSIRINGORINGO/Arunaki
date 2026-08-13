import { Injectable, Logger } from '@nestjs/common';
import PptxGenJS from 'pptxgenjs';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ExcelReportBuilder } from './generators/excel-report-builder.js';
import { PdfReportBuilder } from './generators/pdf-report-builder.js';
import { DocxReportBuilder } from './generators/docx-report-builder.js';

export interface BusinessReportData {
  companyName: string;
  period: string;
  currency?: string;
  revenue?: Array<{ category: string; amount: number }>;
  cogs?: Array<{ category: string; amount: number }>;
  operatingExpenses?: Array<{ category: string; amount: number }>;
  incomeItems?: Array<{ category: string; amount: number }>;
  expenseItems?: Array<{ category: string; amount: number }>;
  assets?: Array<{ category: string; amount: number }>;
  liabilities?: Array<{ category: string; amount: number }>;
  equity?: Array<{ category: string; amount: number }>;
}

@Injectable()
export class DocumentGeneratorTool {
  private readonly logger = new Logger(DocumentGeneratorTool.name);
  private readonly excelBuilder = new ExcelReportBuilder();
  private readonly pdfBuilder = new PdfReportBuilder();
  private readonly docxBuilder = new DocxReportBuilder();

  generateExcel(
    sheetName: string,
    rows: Array<Record<string, any>>,
    filename: string = 'export.xlsx',
    outputPath?: string,
  ): ToolResult {
    return this.excelBuilder.generateExcel(sheetName, rows, filename, outputPath);
  }

  generateCsv(
    rows: Array<Record<string, any>>,
    filename: string = 'export.csv',
    outputPath?: string,
  ): ToolResult {
    return this.excelBuilder.generateCsv(rows, filename, outputPath);
  }

  async generatePdf(
    title: string,
    content: string,
    filename: string = 'document.pdf',
    outputPath?: string,
  ): Promise<ToolResult> {
    return this.pdfBuilder.generatePdf(title, content, filename, outputPath);
  }

  async generateDocx(
    title: string,
    content: string,
    filename: string = 'document.docx',
    outputPath?: string,
  ): Promise<ToolResult> {
    return this.docxBuilder.generateDocx(title, content, filename, outputPath);
  }

  async generatePptx(
    title: string,
    slides: Array<{ heading?: string; content: string }>,
    filename: string = 'presentation.pptx',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

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

        const bulletLines = slide.content.split('\n').filter((l) => l.trim().length > 0);
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
        preview: `${title} — ${slides.length + 1} slide, ${buffer.length} bytes`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'pptx',
          filename: safeFilename,
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          contentBase64,
        },
      };
    } catch (e: any) {
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

  async generateRugReport(
    data: BusinessReportData,
    filename: string = 'rug-report.xlsx',
  ): Promise<ToolResult> {
    const summaryRows: Array<Record<string, string | number>> = [
      { Laporan: 'Laporan Rincian Usaha (RUG)', Periode: data.period, Perusahaan: data.companyName },
    ];
    if (data.revenue) {
      data.revenue.forEach((r) => summaryRows.push({ Laporan: r.category, Jumlah: r.amount }));
    }
    return this.excelBuilder.generateExcel('RUG', summaryRows, filename);
  }

  async generateNeracaReport(
    data: BusinessReportData,
    filename: string = 'neraca-report.xlsx',
  ): Promise<ToolResult> {
    const summaryRows: Array<Record<string, string | number>> = [
      { Laporan: 'Laporan Neraca Keuangan', Periode: data.period, Perusahaan: data.companyName },
    ];
    if (data.assets) {
      data.assets.forEach((a) => summaryRows.push({ Laporan: a.category, Jumlah: a.amount }));
    }
    return this.excelBuilder.generateExcel('Neraca', summaryRows, filename);
  }

  async generateLabaRugiReport(
    data: BusinessReportData,
    filename: string = 'laba-rugi-report.xlsx',
  ): Promise<ToolResult> {
    const summaryRows: Array<Record<string, string | number>> = [
      { Laporan: 'Laporan Laba Rugi', Periode: data.period, Perusahaan: data.companyName },
    ];
    if (data.incomeItems) {
      data.incomeItems.forEach((i) => summaryRows.push({ Laporan: i.category, Jumlah: i.amount }));
    }
    return this.excelBuilder.generateExcel('Laba Rugi', summaryRows, filename);
  }
}
