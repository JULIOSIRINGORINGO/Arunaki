import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/providers/prisma.service';
import { SearchProvider, SearchOptions, SearchResult } from './search-provider.interface';

@Injectable()
export class FtsSearchProvider implements SearchProvider {
  private readonly logger = new Logger(FtsSearchProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { workspaceId, query, limit = 10, offset = 0 } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // Use LIKE for now since FTS5 requires virtual table setup
      const files = await this.prisma.file.findMany({
        where: {
          source: { workspaceId },
          content: { contains: query },
        },
        take: limit,
        skip: offset,
      });

      return files.map((file) => ({
        fileId: file.id,
        fileName: file.name,
        filePath: file.path,
        fileType: file.type,
        score: 0.8,
        source: 'fts' as const,
        matchedContent: this.extractMatch(file.content || '', query),
      }));
    } catch (error) {
      this.logger.warn(`FTS search failed: ${error.message}`);
      return [];
    }
  }

  private extractMatch(content: string, query: string): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return content.substring(0, 100);

    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + query.length + 40);
    return (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
  }
}
