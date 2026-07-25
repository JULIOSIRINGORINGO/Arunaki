import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentReaderTool {
  private readonly logger = new Logger(DocumentReaderTool.name);

  async readDocument(filePath: string): Promise<ToolResult> {
    const startTime = Date.now();

    if (!filePath || filePath.trim().length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Path file tidak boleh kosong',
        metadata: {
          toolName: 'document_reader',
          displayName: 'Pembaca Dokumen',
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
          toolName: 'document_reader',
          displayName: 'Pembaca Dokumen',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'FILE_NOT_FOUND', message: `File not found: ${resolvedPath}` },
      };
    }

    try {
      const ext = path.extname(resolvedPath).toLowerCase();
      let text = '';

      switch (ext) {
        case '.pdf':
          text = await this.readPdf(resolvedPath);
          break;
        case '.docx':
          text = await this.readDocx(resolvedPath);
          break;
        case '.xlsx':
        case '.xls':
          text = await this.readExcel(resolvedPath);
          break;
        case '.csv':
          text = await this.readCsv(resolvedPath);
          break;
        case '.txt':
          text = fs.readFileSync(resolvedPath, 'utf-8');
          break;
        default:
          return {
            status: 'error',
            data: {},
            preview: `Format ${ext} tidak didukung. Gunakan: .pdf, .docx, .xlsx, .csv, .txt`,
            metadata: {
              toolName: 'document_reader',
              displayName: 'Pembaca Dokumen',
              executionTime: Date.now() - startTime,
            },
            error: { code: 'UNSUPPORTED_FORMAT', message: `Format ${ext} not supported` },
          };
      }

      const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;

      return {
        status: 'success',
        data: {
          text,
          format: ext,
          filename: path.basename(resolvedPath),
          charCount: text.length,
          lineCount: text.split('\n').length,
        },
        preview,
        metadata: {
          toolName: 'document_reader',
          displayName: 'Pembaca Dokumen',
          executionTime: Date.now() - startTime,
          format: ext,
          filename: path.basename(resolvedPath),
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal membaca file: ${e.message}`,
        metadata: {
          toolName: 'document_reader',
          displayName: 'Pembaca Dokumen',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'READ_FAILED', message: e.message },
      };
    }
  }

  private async readPdf(filePath: string): Promise<string> {
    const PDFParser = (await import('pdf2json')).default;
    const buffer = fs.readFileSync(filePath);

    return new Promise<string>((resolve, reject) => {
      const parser = new PDFParser();

      parser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(errData.parserError || 'PDF parse error'));
      });

      parser.on('pdfParser_dataReady', (pdfData: any) => {
        const pages = pdfData.Pages || [];
        const textParts: string[] = [];

        for (const page of pages) {
          const texts: string[] = [];
          for (const text of page.Texts || []) {
            for (const r of text.R || []) {
              texts.push(decodeURIComponent(r.T || ''));
            }
          }
          textParts.push(texts.join(' '));
        }

        resolve(textParts.join('\n\n'));
      });

      parser.parseBuffer(buffer);
    });
  }

  private async readDocx(filePath: string): Promise<string> {
    const mammoth = await import('mammoth');
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private async readExcel(filePath: string): Promise<string> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const allText: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      allText.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }

    return allText.join('\n\n');
  }

  private async readCsv(filePath: string): Promise<string> {
    const csvParse = await import('csv-parse/sync');
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = csvParse.parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const lines: string[] = [];
    for (const record of records) {
      const values = Object.values(record as Record<string, string>);
      lines.push(values.join(' | '));
    }

    return lines.join('\n');
  }
}
