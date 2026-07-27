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
        preview: 'Query pencarian tidak boleh kosong',
        metadata: {
          toolName: 'doc_search',
          displayName: 'Pencarian Dokumen',
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
          : `Tidak ditemukan hasil untuk "${query}"`;

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
          displayName: 'Pencarian Dokumen',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      this.logger.error(`Search failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Pencarian gagal: ${e.message}`,
        metadata: {
          toolName: 'doc_search',
          displayName: 'Pencarian Dokumen',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'SEARCH_FAILED', message: e.message },
      };
    }
  }

  private async searchKnowledge(query: string, limit: number) {
    try {
      const results = await this.prisma.knowledge.findMany({
        where: {
          active: true,
          OR: [
            { title: { contains: query } },
            { content: { contains: query } },
          ],
        },
        take: limit,
      });

      return results.map((r) => ({
        type: 'knowledge',
        id: r.id,
        title: r.title,
        preview: r.content.substring(0, 200),
        relevance: this.calculateRelevance(query, r.title + ' ' + r.content),
      }));
    } catch {
      return [];
    }
  }

  private async searchFiles(query: string, limit: number) {
    try {
      const results = await this.prisma.file.findMany({
        where: {
          OR: [{ name: { contains: query } }, { type: { contains: query } }],
        },
        take: limit,
      });

      return results.map((r) => ({
        type: 'file',
        id: r.id,
        title: r.name,
        preview: `Type: ${r.type} | Size: ${r.size} bytes`,
        relevance: this.calculateRelevance(query, r.name),
      }));
    } catch {
      return [];
    }
  }

  private async searchMessages(query: string, limit: number) {
    try {
      const results = await this.prisma.message.findMany({
        where: {
          content: { contains: query },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return results.map((r) => ({
        type: 'message',
        id: r.id,
        title: `Chat message (${r.role})`,
        preview: r.content.substring(0, 200),
        relevance: this.calculateRelevance(query, r.content),
      }));
    } catch {
      return [];
    }
  }

  private calculateRelevance(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const matches = (textLower.match(new RegExp(queryLower, 'g')) || []).length;
    return matches;
  }
}
