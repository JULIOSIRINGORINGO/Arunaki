import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SearchService } from '../../search/search.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class SearchToolService {
  private readonly logger = new Logger(SearchToolService.name);

  constructor(
    @Inject(forwardRef(() => SearchService)) private readonly searchService: SearchService,
  ) {}

  async execute(workspaceId: string, query: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const results = this.searchService
        ? await this.searchService.searchFiles({ workspaceId, query })
        : [];

      const previewText =
        results.length > 0
          ? results
              .map(
                (r: any, i: number) =>
                  `[${i + 1}] ${r.title || r.filename}\nSnippet: ${r.snippet || r.content?.slice(0, 200)}...`,
              )
              .join('\n\n')
          : `No search results found for query "${query}".`;

      return {
        status: 'success',
        data: { query, results, total: results.length },
        preview: previewText,
        metadata: {
          toolName: 'search_workspace',
          displayName: 'Search Workspace',
          executionTime: Date.now() - startTime,
          query,
          resultCount: results.length,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to search workspace: ${e.message}`,
        metadata: { toolName: 'search_workspace', displayName: 'Search Workspace', executionTime: Date.now() - startTime },
        error: { code: 'SEARCH_FAILED', message: e.message },
      };
    }
  }
}
