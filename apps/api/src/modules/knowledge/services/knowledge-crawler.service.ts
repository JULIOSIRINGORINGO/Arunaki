import { Injectable, Logger } from '@nestjs/common';
import TurndownService from 'turndown';

export interface KnowledgeLiveFetchOptions {
  url: string;
  query?: string;
  format?: 'text' | 'markdown' | 'html';
  timeout?: number;
  filters?: Record<string, any>;
  selector?: string;
}

export interface KnowledgeLiveFetchResult {
  title: string;
  url: string;
  query?: string;
  extractedContent: string;
  structuredData?: Record<string, any>;
  durationMs: number;
  extractedAt: string;
}

const DEFAULT_TIMEOUT = 30000;
const MAX_TIMEOUT = 120000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});
turndownService.remove(['script', 'style', 'meta', 'link', 'noscript']);

/**
 * KnowledgeCrawlerService — 1:1 match with opencode webfetch.
 * HTTP fetch + Turndown (HTML→Markdown). No browser, no Playwright.
 */
@Injectable()
export class KnowledgeCrawlerService {
  private readonly logger = new Logger(KnowledgeCrawlerService.name);
  private cache = new Map<string, { data: KnowledgeLiveFetchResult; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  async fetchLiveKnowledge(options: KnowledgeLiveFetchOptions): Promise<KnowledgeLiveFetchResult> {
    const startTime = Date.now();
    const { url, query = '', format = 'markdown', timeout: userTimeout } = options;

    const cacheKey = `${url}|${query}|${format}`.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.log(`[KnowledgeCrawler] Cache hit for ${url} (0ms)`);
      return cached.data;
    }

    this.logger.log(`[KnowledgeCrawler] Fetching: ${url} (format: ${format})`);

    let extractedTitle = '';
    let extractedContent = '';
    let structuredData: Record<string, any> = {};

    try {
      const timeout = Math.min((userTimeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      // Build Accept header based on format
      let acceptHeader = '*/*';
      switch (format) {
        case 'markdown':
          acceptHeader = 'text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1';
          break;
        case 'text':
          acceptHeader = 'text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1';
          break;
        case 'html':
          acceptHeader = 'text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1';
          break;
        default:
          acceptHeader = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
      }

      let response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'Accept': acceptHeader,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Retry with honest UA if blocked by Cloudflare
      if (response.status === 403 && response.headers.get('cf-mitigated') === 'challenge') {
        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), timeout);
        response = await fetch(url, {
          headers: {
            'User-Agent': 'opencode',
            'Accept': acceptHeader,
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: retryController.signal,
        });
        clearTimeout(retryTimer);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        throw new Error('Response too large (exceeds 5MB limit)');
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
        throw new Error('Response too large (exceeds 5MB limit)');
      }

      const contentType = response.headers.get('content-type') || '';
      const mime = contentType.split(';')[0]?.trim().toLowerCase() || '';
      extractedTitle = `${url} (${contentType})`;

      const content = new TextDecoder().decode(arrayBuffer);

      // Extract title from HTML
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) extractedTitle = titleMatch[1].trim();

      // Handle based on format
      switch (format) {
        case 'markdown':
          if (contentType.includes('text/html')) {
            extractedContent = turndownService.turndown(content);
          } else {
            extractedContent = content;
          }
          break;

        case 'text':
          if (contentType.includes('text/html')) {
            extractedContent = this.extractTextFromHTML(content);
          } else {
            extractedContent = content;
          }
          break;

        case 'html':
          extractedContent = content;
          break;

        default:
          extractedContent = content;
      }

      structuredData = {
        url,
        format,
        contentType: mime,
        size: arrayBuffer.byteLength,
      };

    } catch (err: any) {
      this.logger.warn(`[KnowledgeCrawler] Fetch error: ${err.message}`);
    }

    const result: KnowledgeLiveFetchResult = {
      title: extractedTitle || 'External Live Knowledge Page',
      url,
      query,
      extractedContent: extractedContent || 'No readable text extracted from target page.',
      structuredData,
      durationMs: Date.now() - startTime,
      extractedAt: new Date().toISOString(),
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  private extractTextFromHTML(html: string): string {
    // Strip script, style, noscript, etc.
    let clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '');

    // Extract text content
    const text = clean
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('\n');

    return text.trim();
  }
}
