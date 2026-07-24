import { Injectable, Logger } from '@nestjs/common';
import { SearchProvider, SearchOptions, SearchResult } from './providers/search-provider.interface';
import { MetadataSearchProvider } from './providers/metadata-search.provider';
import { FtsSearchProvider } from './providers/fts-search.provider';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly providers: SearchProvider[];

  constructor(
    private readonly metadataSearch: MetadataSearchProvider,
    private readonly ftsSearch: FtsSearchProvider,
  ) {
    this.providers = [metadataSearch, ftsSearch];
    this.logger.log('SearchService initialized with metadata + FTS providers');
  }

  async searchFiles(options: SearchOptions): Promise<SearchResult[]> {
    const { query, limit = 10 } = options;

    this.logger.log(`Searching: query="${query}", workspace=${options.workspaceId}`);

    // Run all providers in parallel
    const results = await Promise.all(
      this.providers.map((provider) => provider.search(options)),
    );

    // Flatten and deduplicate
    const seen = new Set<string>();
    const combined: SearchResult[] = [];

    for (const providerResults of results) {
      for (const result of providerResults) {
        if (!seen.has(result.fileId)) {
          seen.add(result.fileId);
          combined.push(result);
        }
      }
    }

    // Sort by score descending
    combined.sort((a, b) => b.score - a.score);

    // Apply limit
    return combined.slice(0, limit);
  }
}
