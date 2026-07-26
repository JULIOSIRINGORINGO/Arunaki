import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tavily } from '@tavily/core';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class WebSearchTool {
  private readonly logger = new Logger(WebSearchTool.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('TAVILY_API_KEY') || '';
  }

  async searchWeb(query: string, searchDepth: 'basic' | 'advanced' = 'basic'): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      if (!query || query.trim().length === 0) {
        return {
          status: 'error',
          data: {},
          preview: 'Query pencarian tidak boleh kosong.',
          metadata: { toolName: 'web_search', displayName: 'Pencarian Web', executionTime: Date.now() - startTime },
          error: { code: 'INVALID_QUERY', message: 'Query pencarian tidak boleh kosong' },
        };
      }

      if (!this.apiKey) {
        this.logger.warn('TAVILY_API_KEY is not configured in environment variables.');
        return {
          status: 'error',
          data: {},
          preview: 'Fitur pencarian web belum dikonfigurasi (TAVILY_API_KEY belum dipasang).',
          metadata: { toolName: 'web_search', displayName: 'Pencarian Web', executionTime: Date.now() - startTime },
          error: {
            code: 'SEARCH_KEY_MISSING',
            message: 'Fitur pencarian web belum dikonfigurasi (TAVILY_API_KEY belum dipasang).',
          },
        };
      }

      const client = tavily({ apiKey: this.apiKey });
      const response = await client.search(query, {
        searchDepth,
        maxResults: 5,
        includeAnswer: true,
      });

      const results = (response.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
      }));

      const summaryText = response.answer
        ? `Ringkasan: ${response.answer}\n\nSumber:\n` +
          results.map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`).join('\n\n')
        : results.map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`).join('\n\n');

      return {
        status: 'success',
        data: {
          query,
          answer: response.answer || null,
          results,
          total: results.length,
        },
        preview: summaryText,
        metadata: {
          toolName: 'web_search',
          displayName: 'Pencarian Web',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(`Web search failed for query "${query}": ${error.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Pencarian gagal: ${error.message}`,
        metadata: { toolName: 'web_search', displayName: 'Pencarian Web', executionTime: Date.now() - startTime },
        error: { code: 'WEB_SEARCH_FAILED', message: error.message },
      };
    }
  }
}
