import * as fs from 'fs/promises';
import { ParseResult, ParserProvider } from './parser-provider.interface';

export class CsvParser implements ParserProvider {
  async parse(filePath: string): Promise<ParseResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const headers = lines[0] ? lines[0].split(',').map(h => h.trim()) : [];
    const rowCount = Math.max(0, lines.length - 1); // Exclude header

    // Parse CSV to JSON for structured content
    const data: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return {
      content: JSON.stringify(data, null, 2),
      metadata: {
        rowCount,
        columnCount: headers.length,
        columns: headers,
      },
    };
  }
}
