import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentReaderTool {
  private readonly logger = new Logger(DocumentReaderTool.name);

  async readDocument(
    filePath: string,
    targetSheetName?: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    if (!filePath || filePath.trim().length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'File path cannot be empty',
        metadata: {
          toolName: 'document_reader',
          displayName: 'Document Reader',
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
        preview: `File not found: ${resolvedPath}`,
        metadata: {
          toolName: 'document_reader',
          displayName: 'Document Reader',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'FILE_NOT_FOUND',
          message: `File not found: ${resolvedPath}`,
        },
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
        case '.xlsm':
        case '.xlsb':
          text = await this.readExcel(resolvedPath, targetSheetName);
          break;
        case '.csv':
          text = await this.readCsv(resolvedPath);
          break;
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.webp':
        case '.bmp':
        case '.tiff':
        case '.tif':
          text = await this.readImageOcr(resolvedPath);
          break;
        case '.txt':
        case '.md':
        case '.json':
        case '.xml':
        case '.html':
          text = fs.readFileSync(resolvedPath, 'utf-8');
          break;
        default:
          return {
            status: 'error',
            data: {},
            preview: `Unsupported format: ${ext}`,
            metadata: {
              toolName: 'document_reader',
              displayName: 'Document Reader',
              executionTime: Date.now() - startTime,
            },
            error: {
              code: 'UNSUPPORTED_FORMAT',
              message: `Format ${ext} not supported`,
            },
          };
      }

      const preview =
        text.length > 2500 ? text.substring(0, 2500) + '... [truncated]' : text;

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
          displayName: 'Document Reader',
          executionTime: Date.now() - startTime,
          format: ext,
          filename: path.basename(resolvedPath),
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to read file: ${e.message}`,
        metadata: {
          toolName: 'document_reader',
          displayName: 'Document Reader',
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
              try {
                texts.push(decodeURIComponent(r.T || ''));
              } catch {
                texts.push(r.T || '');
              }
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

  private async readExcel(
    filePath: string,
    targetSheetName?: string,
  ): Promise<string> {
    const XLSXModule = await import('xlsx');
    const XLSX = XLSXModule.default || XLSXModule;
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames || [];

    if (sheetNames.length === 0) {
      return 'Empty Excel Workbook (No Sheets)';
    }

    // Determine target sheet:
    let selectedSheet: string | undefined;
    if (targetSheetName) {
      selectedSheet = sheetNames.find(
        (s) => s.toLowerCase() === targetSheetName.trim().toLowerCase(),
      );
    }

    // If no specific sheet requested, try to pick current month (e.g. AGUSTUS / AUGUST) or first sheet
    if (!selectedSheet) {
      const now = new Date();
      const monthNamesId = [
        'JANUARI',
        'FEBRUARI',
        'MARET',
        'APRIL',
        'MEI',
        'JUNI',
        'JULI',
        'AGUSTUS',
        'SEPTEMBER',
        'OKTOBER',
        'NOVEMBER',
        'DESEMBER',
      ];
      const monthNamesEn = [
        'JANUARY',
        'FEBRUARY',
        'MARCH',
        'APRIL',
        'MAY',
        'JUNE',
        'JULY',
        'AUGUST',
        'SEPTEMBER',
        'OCTOBER',
        'NOVEMBER',
        'DECEMBER',
      ];
      const currentMonthId = monthNamesId[now.getMonth()];
      const currentMonthEn = monthNamesEn[now.getMonth()];

      selectedSheet =
        sheetNames.find((s) => s.toUpperCase() === currentMonthId) ||
        sheetNames.find((s) => s.toUpperCase() === currentMonthEn) ||
        sheetNames[0];
    }

    const sheet = workbook.Sheets[selectedSheet];
    if (!sheet) {
      return `Available Sheets: [${sheetNames.join(', ')}]\n=== Sheet Not Found: ${selectedSheet} ===`;
    }

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const formattedRows: string[] = [];

    for (let r = 0; r < Math.min(rows.length, 50); r++) {
      const row = rows[r] || [];
      const cells: string[] = [];
      for (let c = 0; c < Math.min(row.length, 35); c++) {
        const val = row[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const colLetter = XLSX.utils.encode_col(c);
          cells.push(`${colLetter}${r + 1}: ${String(val).trim()}`);
        }
      }
      if (cells.length > 0) {
        formattedRows.push(`Row ${r + 1} -> ${cells.join(' | ')}`);
      }
    }

    const gridText = formattedRows.join('\n');
    return `Available Sheets: [${sheetNames.join(', ')}]\n=== Active Sheet: ${selectedSheet} (Grid Matrix: Col C=Day 1 .. Col V=Day 20 .. Col AG=Day 31) ===\n${gridText}`;
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

  private async readImageOcr(filePath: string): Promise<string> {
    try {
      this.logger.log(`Performing OCR extraction on image: ${filePath}`);
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(filePath, 'eng');
      const text = data.text.trim();
      return text.length > 0 ? text : '[OCR Image Scan: No readable text detected in this image]';
    } catch (err: any) {
      this.logger.error(`OCR extraction failed on ${filePath}: ${err.message}`);
      throw new Error(`Failed to extract text from image (OCR error): ${err.message}`);
    }
  }
}
