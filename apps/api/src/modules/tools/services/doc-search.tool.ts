import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class DocSearchTool {
  private readonly logger = new Logger(DocSearchTool.name);
  private readonly prisma = new PrismaClient();

  async searchDocuments(query: string, limit?: number): Promise<ToolResult> {
    const startTime = Date.now();

    if (!query || query.trim().length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Search query cannot be empty',
        metadata: {
          toolName: 'doc_search',
          displayName: 'Document Search',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_QUERY', message: 'Search query required' },
      };
    }

    try {
      const searchLimit = limit || 10;

      const knowledgeResults = await this.searchKnowledge(query, searchLimit);
      const fileResults = await this.searchFiles(query, searchLimit);
      const messageResults = await this.searchMessages(query, searchLimit);

      const allResults = [
        ...knowledgeResults,
        ...fileResults,
        ...messageResults,
      ].slice(0, searchLimit);

      const preview =
        allResults.length > 0
          ? allResults
              .map((r, i) => `${i + 1}. [${r.type}] ${r.title}: ${r.preview}`)
              .join('\n')
          : `No results found for "${query}"`;

      return {
        status: 'success',
        data: {
          query,
          totalResults: allResults.length,
          results: allResults,
        },
        preview,
        metadata: {
          toolName: 'doc_search',
          displayName: 'Document Search',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      this.logger.error(`Search failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Search failed: ${e.message}`,
        metadata: {
          toolName: 'doc_search',
          displayName: 'Document Search',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'SEARCH_FAILED', message: e.message },
      };
    }
  }

  private async searchKnowledge(
    query: string,
    limit: number,
  ): Promise<
    Array<{ id: string; type: string; title: string; preview: string }>
  > {
    try {
      const results = await (this.prisma as any).knowledge.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { content: { contains: query } },
          ],
        },
        take: limit,
      });

      return results.map((d: any) => ({
        id: d.id,
        type: 'knowledge',
        title: d.title,
        preview:
          d.content && d.content.length > 100
            ? d.content.substring(0, 100) + '...'
            : (d.content || ''),
      }));
    } catch {
      return [];
    }
  }

  private async searchFiles(
    query: string,
    limit: number,
  ): Promise<
    Array<{ id: string; type: string; title: string; preview: string }>
  > {
    try {
      const results = await this.prisma.file.findMany({
        where: {
          OR: [{ name: { contains: query } }, { path: { contains: query } }],
        },
        take: limit,
      });

      return results.map((f) => ({
        id: f.id,
        type: 'file',
        title: f.name,
        preview: f.path,
      }));
    } catch {
      return [];
    }
  }

  private async searchMessages(
    query: string,
    limit: number,
  ): Promise<
    Array<{ id: string; type: string; title: string; preview: string }>
  > {
    try {
      const results = await this.prisma.message.findMany({
        where: {
          content: { contains: query },
        },
        take: limit,
      });

      return results.map((m) => ({
        id: m.id,
        type: 'message',
        title: `Pesan (${m.role})`,
        preview:
          m.content.length > 100
            ? m.content.substring(0, 100) + '...'
            : m.content,
      }));
    } catch {
      return [];
    }
  }
}
