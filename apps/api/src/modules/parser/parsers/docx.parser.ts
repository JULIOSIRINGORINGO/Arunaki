import * as fs from 'fs/promises';
import { ParseResult, ParserProvider } from './parser-provider.interface';

export class DocxParser implements ParserProvider {
  async parse(filePath: string): Promise<ParseResult> {
    const mammoth = await import('mammoth');
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const content = result.value;

    const words = content.split(/\s+/).filter(w => w.length > 0);
    const lines = content.split('\n');

    return {
      content,
      metadata: {
        wordCount: words.length,
        lineCount: lines.length,
        characterCount: content.length,
      },
    };
  }
}
