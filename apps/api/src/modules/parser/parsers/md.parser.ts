import * as fs from 'fs/promises';
import { ParseResult, ParserProvider } from './parser-provider.interface';

export class MdParser implements ParserProvider {
  async parse(filePath: string): Promise<ParseResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const words = content.split(/\s+/).filter(w => w.length > 0);

    // Extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : undefined;

    // Count headings for structure
    const headingCount = (content.match(/^#{1,6}\s+/gm) || []).length;

    return {
      content,
      metadata: {
        title,
        wordCount: words.length,
        lineCount: lines.length,
        characterCount: content.length,
        headingCount,
      },
    };
  }
}
