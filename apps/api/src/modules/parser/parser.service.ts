import { Injectable, Logger } from '@nestjs/common';
import { ParserProvider, ParseResult } from './parsers/parser-provider.interface';
import { TxtParser } from './parsers/txt.parser';
import { MdParser } from './parsers/md.parser';
import { CsvParser } from './parsers/csv.parser';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';
import { XlsxParser } from './parsers/xlsx.parser';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);
  private readonly parsers: Map<string, ParserProvider>;

  constructor() {
    this.parsers = new Map<string, ParserProvider>();
    this.parsers.set('txt', new TxtParser());
    this.parsers.set('md', new MdParser());
    this.parsers.set('csv', new CsvParser());
    this.parsers.set('pdf', new PdfParser());
    this.parsers.set('docx', new DocxParser());
    this.parsers.set('xlsx', new XlsxParser());
    this.parsers.set('xls', new XlsxParser());

    this.logger.log(`Initialized parsers: ${Array.from(this.parsers.keys()).join(', ')}`);
  }

  async parse(filePath: string, fileType: string): Promise<ParseResult> {
    const parser = this.parsers.get(fileType.toLowerCase());
    if (!parser) {
      throw new Error(`No parser found for file type: ${fileType}`);
    }

    this.logger.log(`Parsing file: ${filePath} (type: ${fileType})`);
    return parser.parse(filePath);
  }

  getSupportedTypes(): string[] {
    return Array.from(this.parsers.keys());
  }

  isSupported(fileType: string): boolean {
    return this.parsers.has(fileType.toLowerCase());
  }
}
