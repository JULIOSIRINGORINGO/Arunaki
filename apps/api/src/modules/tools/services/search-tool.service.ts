import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { SearchService } from '../../search/search.service.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class SearchToolService {
  private readonly logger = new Logger(SearchToolService.name);

  constructor(
    @Inject(forwardRef(() => SearchService))
    private readonly searchService: SearchService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
  ) {}

  async execute(workspaceId: string, query: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      let results = this.searchService
        ? await this.searchService.searchFiles({ workspaceId, query })
        : [];

      // Desktop Workspace disk fallback: if database search returned 0 results, search disk rootPath directly
      if (results.length === 0 && this.prisma) {
        try {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { rootPath: true },
          });

          if (workspace?.rootPath && fs.existsSync(workspace.rootPath)) {
            const rootPath = workspace.rootPath;
            const entries = fs.readdirSync(rootPath, { withFileTypes: true });
            const lowerQuery = (query || '').toLowerCase().trim();

            for (const entry of entries) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
              const fullPath = path.join(rootPath, entry.name);

              if (entry.isFile()) {
                const nameMatches = !lowerQuery || entry.name.toLowerCase().includes(lowerQuery);
                let contentSnippet = '';
                let matched = nameMatches;

                // If text/data file, also check content if name didn't match
                const ext = path.extname(entry.name).toLowerCase();
                const isText = ['.txt', '.md', '.csv', '.json', '.tsv', '.log', '.docx', '.xlsx', '.xlsm'].includes(ext);

                if (isText && fs.existsSync(fullPath)) {
                  try {
                    const sample = fs.readFileSync(fullPath, 'utf8').slice(0, 10000);
                    if (!matched && lowerQuery && sample.toLowerCase().includes(lowerQuery)) {
                      matched = true;
                      const idx = sample.toLowerCase().indexOf(lowerQuery);
                      contentSnippet = sample.slice(Math.max(0, idx - 50), Math.min(sample.length, idx + 150));
                    } else if (nameMatches) {
                      contentSnippet = sample.slice(0, 200);
                    }
                  } catch {
                    // Binary or unreadable text sample
                  }
                }

                if (matched) {
                  results.push({
                    fileId: entry.name,
                    fileName: entry.name,
                    title: entry.name,
                    filePath: fullPath,
                    snippet: contentSnippet || `File: ${entry.name}`,
                    score: nameMatches ? 1.0 : 0.8,
                  } as any);
                }
              }
            }
          }
        } catch (diskErr: any) {
          this.logger.warn(`Disk search fallback failed: ${diskErr.message}`);
        }
      }

      const previewText =
        results.length > 0
          ? results
              .map(
                (r: any, i: number) =>
                  `[${i + 1}] ${r.title || r.fileName || r.filename}\nSnippet: ${r.snippet || r.content?.slice(0, 200) || r.filePath}...`,
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
        metadata: {
          toolName: 'search_workspace',
          displayName: 'Search Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'SEARCH_FAILED', message: e.message },
      };
    }
  }
}
