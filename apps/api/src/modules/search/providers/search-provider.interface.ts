export interface SearchResult {
  fileId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  score: number;
  source: 'metadata' | 'fts';
  matchedContent?: string;
}

export interface SearchOptions {
  workspaceId: string;
  query?: string;
  fileType?: string;
  limit?: number;
  offset?: number;
}

export interface SearchProvider {
  search(options: SearchOptions): Promise<SearchResult[]>;
}
