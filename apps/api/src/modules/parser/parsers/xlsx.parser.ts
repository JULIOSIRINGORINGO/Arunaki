import * as fs from 'fs/promises';
import { ParseResult, ParserProvider } from './parser-provider.interface';

export class XlsxParser implements ParserProvider {
  async parse(filePath: string): Promise<ParseResult> {
    const XLSX = await import('xlsx');
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const allText: string[] = [];
    const sheetNames = workbook.SheetNames;
    const sheetsData: Record<string, any[]> = {};

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      const textData = XLSX.utils.sheet_to_csv(sheet);

      sheetsData[sheetName] = jsonData;
      allText.push(`=== Sheet: ${sheetName} ===\n${textData}`);
    }

    const content = allText.join('\n\n');
    const words = content.split(/\s+/).filter(w => w.length > 0);

    return {
      content,
      metadata: {
        sheetNames,
        sheetCount: sheetNames.length,
        wordCount: words.length,
        characterCount: content.length,
      },
    };
  }
}
