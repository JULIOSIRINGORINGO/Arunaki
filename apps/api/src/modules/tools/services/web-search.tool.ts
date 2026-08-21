import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tavily } from '@tavily/core';
import { ToolResult } from '../interfaces/tool-result.interface.js';

export interface WebSearchResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
}

@Injectable()
export class WebSearchTool {
  private readonly logger = new Logger(WebSearchTool.name);
  private readonly apiKey: string;

  constructor(private readonly config?: ConfigService) {
    this.apiKey =
      this.config?.get<string>('TAVILY_API_KEY') ||
      process.env.TAVILY_API_KEY ||
      '';
  }

  async searchWeb(
    query: string,
    searchDepth: 'basic' | 'advanced' = 'basic',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      if (!query || query.trim().length === 0) {
        return {
          status: 'error',
          data: {},
          preview: 'Query pencarian tidak boleh kosong.',
          metadata: {
            toolName: 'web_search',
            displayName: 'Search Web',
            executionTime: Date.now() - startTime,
          },
          error: {
            code: 'INVALID_QUERY',
            message: 'Query pencarian tidak boleh kosong',
          },
        };
      }

      const cleanQuery = query.trim();
      this.logger.log(`[WebSearchTool] Searching web for: "${cleanQuery}"`);

      // 1. Try Tavily API if configured
      if (this.apiKey) {
        try {
          const client = tavily({ apiKey: this.apiKey });
          const response = await client.search(cleanQuery, {
            searchDepth,
            maxResults: 6,
            includeAnswer: true,
          });

          const results: WebSearchResultItem[] = (response.results || []).map(
            (r) => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score,
            }),
          );

          if (results.length > 0) {
            const summaryText = response.answer
              ? `Ringkasan: ${response.answer}\n\nSumber:\n` +
                results
                  .map(
                    (r, i) =>
                      `[${i + 1}] **${r.title}** (${r.url})\n${r.content}`,
                  )
                  .join('\n\n')
              : results
                  .map(
                    (r, i) =>
                      `[${i + 1}] **${r.title}** (${r.url})\n${r.content}`,
                  )
                  .join('\n\n');

            return {
              status: 'success',
              data: {
                query: cleanQuery,
                engine: 'tavily',
                answer: response.answer || null,
                results,
                total: results.length,
              },
              preview: summaryText,
              metadata: {
                toolName: 'web_search',
                displayName: 'Search Web',
                executionTime: Date.now() - startTime,
              },
            };
          }
        } catch (tavilyErr: any) {
          this.logger.warn(
            `[WebSearchTool] Tavily search error: ${tavilyErr.message}, falling back to free search engines...`,
          );
        }
      }

      // 2. Free Yahoo Web Search Engine (Universal, Zero-key, Unblocked in all regions)
      const yahooResults = await this.searchYahoo(cleanQuery);
      if (yahooResults.length > 0) {
        const summaryText = yahooResults
          .map((r, i) => `[${i + 1}] **${r.title}** (${r.url})\n${r.content}`)
          .join('\n\n');

        return {
          status: 'success',
          data: {
            query: cleanQuery,
            engine: 'yahoo-search',
            results: yahooResults,
            total: yahooResults.length,
          },
          preview: summaryText,
          metadata: {
            toolName: 'web_search',
            displayName: 'Search Web',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 3. Free Bing RSS Search Engine
      const bingResults = await this.searchBingRss(cleanQuery);
      if (bingResults.length > 0) {
        const summaryText = bingResults
          .map((r, i) => `[${i + 1}] **${r.title}** (${r.url})\n${r.content}`)
          .join('\n\n');

        return {
          status: 'success',
          data: {
            query: cleanQuery,
            engine: 'bing-rss',
            results: bingResults,
            total: bingResults.length,
          },
          preview: summaryText,
          metadata: {
            toolName: 'web_search',
            displayName: 'Search Web',
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 4. Fallback: Wikipedia Summary & Instant API
      const wikiResult = await this.searchWikipediaFallback(cleanQuery);
      if (wikiResult) {
        return {
          status: 'success',
          data: {
            query: cleanQuery,
            engine: 'wikipedia-knowledge',
            results: [wikiResult],
            total: 1,
          },
          preview: `[1] **${wikiResult.title}** (${wikiResult.url})\n${wikiResult.content}`,
          metadata: {
            toolName: 'web_search',
            displayName: 'Search Web',
            executionTime: Date.now() - startTime,
          },
        };
      }

      return {
        status: 'success',
        data: {
          query: cleanQuery,
          results: [],
          total: 0,
        },
        preview: `Tidak ditemukan hasil pencarian web untuk "${cleanQuery}".`,
        metadata: {
          toolName: 'web_search',
          displayName: 'Search Web',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `[WebSearchTool] Web search failed for query "${query}": ${error.message}`,
      );
      return {
        status: 'error',
        data: {},
        preview: `Pencarian gagal: ${error.message}`,
        metadata: {
          toolName: 'web_search',
          displayName: 'Search Web',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'WEB_SEARCH_FAILED', message: error.message },
      };
    }
  }

  private async searchYahoo(query: string): Promise<WebSearchResultItem[]> {
    try {
      const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!res.ok) return [];

      const html = await res.text();
      const results: WebSearchResultItem[] = [];

      // Yahoo search result card regex
      const itemRegex =
        /<div[^>]*class="[^"]*algo[^"]*"[^>]*>[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>[\s\S]*?<div[^>]*class="compText[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

      let match: RegExpExecArray | null;
      while ((match = itemRegex.exec(html)) !== null && results.length < 6) {
        let rawUrl = match[1];
        if (rawUrl.includes('/RU=')) {
          const uMatch = rawUrl.match(/\/RU=([^\/]+)/);
          if (uMatch) rawUrl = decodeURIComponent(uMatch[1]);
        }

        const rawTitle = this.stripHtmlTags(match[2]);
        const rawSnippet = this.stripHtmlTags(match[3]);

        if (
          rawUrl.startsWith('http') &&
          rawTitle &&
          rawTitle.toLowerCase() !== 'images'
        ) {
          results.push({
            title: rawTitle,
            url: rawUrl,
            content: rawSnippet || rawTitle,
          });
        }
      }

      return results;
    } catch (err: any) {
      this.logger.debug(`[WebSearchTool] Yahoo search error: ${err.message}`);
      return [];
    }
  }

  private async searchBingRss(query: string): Promise<WebSearchResultItem[]> {
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
      });

      if (!res.ok) return [];

      const xml = await res.text();
      const results: WebSearchResultItem[] = [];
      const itemRegex =
        /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi;

      let match: RegExpExecArray | null;
      while ((match = itemRegex.exec(xml)) !== null && results.length < 6) {
        const rawTitle = this.stripHtmlTags(match[1]);
        const rawLink = match[2].trim();
        const rawDesc = this.stripHtmlTags(match[3]);

        if (rawLink.startsWith('http') && rawTitle) {
          results.push({
            title: rawTitle,
            url: rawLink,
            content: rawDesc || rawTitle,
          });
        }
      }

      return results;
    } catch (err: any) {
      this.logger.debug(`[WebSearchTool] Bing RSS error: ${err.message}`);
      return [];
    }
  }

  private async searchWikipediaFallback(
    query: string,
  ): Promise<WebSearchResultItem | null> {
    try {
      const wikiUrl = `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, '_'))}`;
      const res = await fetch(wikiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          title?: string;
          extract?: string;
          content_urls?: { desktop?: { page?: string } };
        };
        if (data.extract) {
          return {
            title: data.title || query,
            url:
              data.content_urls?.desktop?.page ||
              `https://id.wikipedia.org/wiki/${encodeURIComponent(query)}`,
            content: data.extract,
          };
        }
      }
    } catch {}
    return null;
  }

  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
