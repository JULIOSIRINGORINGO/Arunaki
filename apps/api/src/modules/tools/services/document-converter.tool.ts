import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { PdfReportBuilder } from './generators/pdf-report-builder.js';
import { DocxReportBuilder } from './generators/docx-report-builder.js';
import { ExcelReportBuilder } from './generators/excel-report-builder.js';

@Injectable()
export class DocumentConverterTool {
  private readonly logger = new Logger(DocumentConverterTool.name);
  private readonly pdfBuilder = new PdfReportBuilder();
  private readonly docxBuilder = new DocxReportBuilder();
  private readonly excelBuilder = new ExcelReportBuilder();

  async convertDocument(options: {
    sourcePath: string;
    targetFormat: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt';
    outputPath?: string;
  }): Promise<ToolResult> {
    const startTime = Date.now();
    const { sourcePath, targetFormat } = options;

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return {
        status: 'error',
        data: {},
        preview: `Source file not found: ${sourcePath}`,
        metadata: {
          toolName: 'convert_document',
          displayName: 'Convert Document',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'FILE_NOT_FOUND', message: `Source file not found at ${sourcePath}` },
      };
    }

    const sourceExt = path.extname(sourcePath).toLowerCase().replace('.', '');
    const sourceBase = path.basename(sourcePath, path.extname(sourcePath));
    const targetPath =
      options.outputPath ||
      path.join(path.dirname(sourcePath), `${sourceBase}.${targetFormat}`);

    try {
      // 1. DOCX -> PDF
      if (sourceExt === 'docx' && targetFormat === 'pdf') {
        const result = await mammoth.extractRawText({ path: sourcePath });
        const text = result.value || '';
        const title = sourceBase.replace(/[-_]/g, ' ');
        const genResult = await this.pdfBuilder.generatePdf(
          title,
          text,
          path.basename(targetPath),
          targetPath,
        );
        return {
          status: 'success',
          data: {
            sourcePath,
            targetPath,
            sourceFormat: sourceExt,
            targetFormat,
            size: fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0,
          },
          preview: `Successfully converted ${path.basename(sourcePath)} to PDF (${path.basename(targetPath)})`,
          metadata: {
            toolName: 'convert_document',
            displayName: 'Convert Document',
            executionTime: Date.now() - startTime,
            filename: path.basename(targetPath),
          },
        };
      }

      // 2. TXT / MD -> PDF
      if ((sourceExt === 'txt' || sourceExt === 'md') && targetFormat === 'pdf') {
        const text = fs.readFileSync(sourcePath, 'utf-8');
        const title = sourceBase.replace(/[-_]/g, ' ');
        await this.pdfBuilder.generatePdf(title, text, path.basename(targetPath), targetPath);
        return {
          status: 'success',
          data: { sourcePath, targetPath, sourceFormat: sourceExt, targetFormat },
          preview: `Successfully converted ${path.basename(sourcePath)} to PDF (${path.basename(targetPath)})`,
          metadata: {
            toolName: 'convert_document',
            displayName: 'Convert Document',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 3. TXT / MD -> DOCX
      if ((sourceExt === 'txt' || sourceExt === 'md') && targetFormat === 'docx') {
        const text = fs.readFileSync(sourcePath, 'utf-8');
        const title = sourceBase.replace(/[-_]/g, ' ');
        await this.docxBuilder.generateDocx(title, text, path.basename(targetPath), targetPath);
        return {
          status: 'success',
          data: { sourcePath, targetPath, sourceFormat: sourceExt, targetFormat },
          preview: `Successfully converted ${path.basename(sourcePath)} to DOCX (${path.basename(targetPath)})`,
          metadata: {
            toolName: 'convert_document',
            displayName: 'Convert Document',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 4. XLSX -> CSV
      if ((sourceExt === 'xlsx' || sourceExt === 'xls') && targetFormat === 'csv') {
        const wb = XLSX.readFile(sourcePath);
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
        fs.writeFileSync(targetPath, csvContent, 'utf-8');
        return {
          status: 'success',
          data: { sourcePath, targetPath, sourceFormat: sourceExt, targetFormat },
          preview: `Successfully converted ${path.basename(sourcePath)} to CSV (${path.basename(targetPath)})`,
          metadata: {
            toolName: 'convert_document',
            displayName: 'Convert Document',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 5. XLSX -> PDF
      if ((sourceExt === 'xlsx' || sourceExt === 'xls') && targetFormat === 'pdf') {
        const wb = XLSX.readFile(sourcePath);
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        const formattedLines = rows
          .map((r) => (Array.isArray(r) ? r.join(' | ') : String(r)))
          .join('\n');
        const title = `${sourceBase} Spreadsheet Report`;
        await this.pdfBuilder.generatePdf(title, formattedLines, path.basename(targetPath), targetPath);
        return {
          status: 'success',
          data: { sourcePath, targetPath, sourceFormat: sourceExt, targetFormat },
          preview: `Successfully converted ${path.basename(sourcePath)} to PDF (${path.basename(targetPath)})`,
          metadata: {
            toolName: 'convert_document',
            displayName: 'Convert Document',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 6. Fallback / Unsupported pair
      return {
        status: 'error',
        data: {},
        preview: `Conversion from ${sourceExt} to ${targetFormat} is not currently supported.`,
        metadata: {
          toolName: 'convert_document',
          displayName: 'Convert Document',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'UNSUPPORTED_CONVERSION',
          message: `Cannot convert ${sourceExt} to ${targetFormat}`,
        },
      };
    } catch (err: any) {
      this.logger.error(`Error converting document: ${err.message}`, err.stack);
      return {
        status: 'error',
        data: {},
        preview: `Conversion failed: ${err.message}`,
        metadata: {
          toolName: 'convert_document',
          displayName: 'Convert Document',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'CONVERSION_FAILED', message: err.message },
      };
    }
  }
}
