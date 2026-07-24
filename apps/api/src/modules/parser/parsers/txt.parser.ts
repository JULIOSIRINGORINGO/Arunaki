import * as fs from 'fs/promises';
import { ParseResult, ParserProvider } from './parser-provider.interface';

export class TxtParser implements ParserProvider {
  async parse(filePath: string): Promise<ParseResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const words = content.split(/\s+/).filter(w => w.length > 0);

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
