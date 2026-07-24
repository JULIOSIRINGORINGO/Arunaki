import * as fs from 'fs/promises';
import * as pdfParse from 'pdf-parse';
import { ParseResult, ParserProvider } from './parser-provider.interface';

export class PdfParser implements ParserProvider {
  async parse(filePath: string): Promise<ParseResult> {
    const buffer = await fs.readFile(filePath);
    const data = await (pdfParse as any)(buffer);

    return {
      content: data.text,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).filter((w: string) => w.length > 0).length,
        characterCount: data.text.length,
        producer: data.info?.Producer,
        creator: data.info?.Creator,
      },
    };
  }
}
