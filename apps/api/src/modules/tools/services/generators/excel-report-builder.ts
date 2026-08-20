import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { ToolResult } from '../../interfaces/tool-result.interface.js';

@Injectable()
export class ExcelReportBuilder {
  private readonly logger = new Logger(ExcelReportBuilder.name);

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

      // Write directly to disk if outputPath is provided
      const targetWritePath = outputPath;
      if (targetWritePath) {
        const resolvedTarget = path.resolve(targetWritePath);
        const parentDir = path.dirname(resolvedTarget);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedTarget, buffer);
        this.logger.log(
          `Wrote Excel file physically to disk: ${resolvedTarget}`,
        );
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

      const targetWritePath = outputPath;
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
    } catch (e: any) {
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
}
