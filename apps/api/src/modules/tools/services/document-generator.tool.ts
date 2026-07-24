import { Injectable, Logger } from '@nestjs/common';
import * as xlsx from 'xlsx';

export interface DocumentExportResult {
  filename: string;
  format: 'pdf' | 'xlsx' | 'csv' | 'html';
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

  generateHtmlDocument(
    title: string,
    textContent: string,
    filename: string = 'document.html',
  ): DocumentExportResult {
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111827; line-height: 1.6; }
    h1 { color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
    pre { background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; }
    .footer { margin-top: 40px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; pt: 12px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <pre>${textContent}</pre>
  <div class="footer">Dibuat secara otomatis oleh Arunaki AI Assistant</div>
</body>
</html>`;

    const contentBase64 = Buffer.from(html, 'utf-8').toString('base64');
    return {
      filename: filename.endsWith('.html') ? filename : `${filename}.html`,
      format: 'html',
      contentBase64,
      mimeType: 'text/html',
    };
  }
}
