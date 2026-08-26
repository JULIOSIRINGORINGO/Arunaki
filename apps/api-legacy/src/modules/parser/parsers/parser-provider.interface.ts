export interface ParseResult {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    wordCount?: number;
    lineCount?: number;
    characterCount?: number;
    createdAt?: Date;
    modifiedAt?: Date;
    [key: string]: any;
  };
}

export interface ParserProvider {
  parse(filePath: string): Promise<ParseResult>;
}
