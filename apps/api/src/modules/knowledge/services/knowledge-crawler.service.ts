import { Injectable, Logger } from '@nestjs/common';
import TurndownService from 'turndown';
import { CryptoHarvesterService } from './crypto-harvester.service.js';

export interface KnowledgeLiveFetchOptions {
  url: string;
  query?: string;
  format?: 'text' | 'markdown' | 'html';
  timeout?: number;
  filters?: Record<string, any>;
  selector?: string;
  browser?: boolean;
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
 * KnowledgeCrawlerService — hybrid crawler.
 * HTTP fetch + Turndown (fast path, opencode webfetch style).
 * Playwright fallback for JS-rendered data (stock tables, SPA content).
 */
@Injectable()
export class KnowledgeCrawlerService {
  private readonly logger = new Logger(KnowledgeCrawlerService.name);
  private cache = new Map<
    string,
    { data: KnowledgeLiveFetchResult; timestamp: number }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly cryptoHarvester: CryptoHarvesterService) {}

  async fetchLiveKnowledge(
    options: KnowledgeLiveFetchOptions,
  ): Promise<KnowledgeLiveFetchResult> {
    const startTime = Date.now();
    const {
      url,
      query = '',
      format = 'markdown',
      timeout: userTimeout,
      browser,
    } = options;

    const cacheKey =
      `${url}|${query}|${format}|browser=${!!browser}`.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.log(`[KnowledgeCrawler] Cache hit for ${url} (0ms)`);
      return cached.data;
    }

    // Browser path: JS-rendered data (e.g. stock per location) — HTTP cannot see it.
    if (browser) {
      const result = await this.fetchWithBrowser(
        { url, query, format, timeout: userTimeout },
        startTime,
      );
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    this.logger.log(`[KnowledgeCrawler] Fetching: ${url} (format: ${format})`);

    let extractedTitle = '';
    let extractedContent = '';
    let structuredData: Record<string, any> = {};

    try {
      const timeout = Math.min(
        (userTimeout ?? DEFAULT_TIMEOUT / 1000) * 1000,
        MAX_TIMEOUT,
      );
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      // Build Accept header based on format
      let acceptHeader = '*/*';
      switch (format) {
        case 'markdown':
          acceptHeader =
            'text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1';
          break;
        case 'text':
          acceptHeader =
            'text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1';
          break;
        case 'html':
          acceptHeader =
            'text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1';
          break;
        default:
          acceptHeader =
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
      }

      let response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          Accept: acceptHeader,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Retry with honest UA if blocked by Cloudflare
      if (
        response.status === 403 &&
        response.headers.get('cf-mitigated') === 'challenge'
      ) {
        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), timeout);
        response = await fetch(url, {
          headers: {
            'User-Agent': 'opencode',
            Accept: acceptHeader,
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
      extractedContent:
        extractedContent || 'No readable text extracted from target page.',
      structuredData,
      durationMs: Date.now() - startTime,
      extractedAt: new Date().toISOString(),
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Browser path: generic Playwright render — works on any site.
   * Renders JS content and returns page text/HTML. No per-site hardcoding;
   * for interactive flows (clicks, drawers) the LLM uses browser_interaction.
   */
  private async fetchWithBrowser(
    options: KnowledgeLiveFetchOptions,
    startTime: number,
  ): Promise<KnowledgeLiveFetchResult> {
    const { url, query = '', format = 'markdown' } = options;
    this.logger.log(`[KnowledgeCrawler] Browser fetch: ${url}`);

    let extractedTitle = '';
    let extractedContent = '';
    let apiEncrypted: { url: string; body: string }[] = [];
    let apiDecrypted: string[] = [];

    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        // generic hook: capture encrypted API responses + decrypted data
        await this.cryptoHarvester.install(page);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);

        extractedTitle = (await page.title()) || url;

        if (format === 'html') {
          extractedContent = await page.content();
        } else {
          extractedContent = await page.evaluate(() => document.body.innerText);
        }

        const host = new URL(url).hostname;
        const captured = await this.cryptoHarvester.collect(page, host);
        apiEncrypted = captured.encrypted;
        apiDecrypted = captured.decrypted;
        if (apiEncrypted.length > 0) {
          this.logger.log(
            `[KnowledgeCrawler] Captured ${apiEncrypted.length} encrypted API response(s) on ${host}`,
          );
        }
      } finally {
        await browser.close();
      }
    } catch (err: any) {
      this.logger.warn(`[KnowledgeCrawler] Browser error: ${err.message}`);
    }

    const structuredData: Record<string, any> = {
      url,
      format,
      method: 'browser',
      browser: 'playwright-chromium',
    };

    // Attach decrypted API data when the site encrypts its responses —
    // the decrypted payloads are much more useful than the rendered text.
    if (apiEncrypted.length > 0 || apiDecrypted.length > 0) {
      const interesting = apiDecrypted
        .filter((d) => /stock|left|product|price|color|size/i.test(d))
        .slice(0, 6);
      structuredData.decryptedApiData = interesting;
      structuredData.encryptedApiCount = apiEncrypted.length;
      if (apiDecrypted.length > 0) {
        const extra = interesting.join('\n\n');
        if (extra && !extractedContent.includes(extra.slice(0, 80))) {
          extractedContent = `${extractedContent}\n\n=== DECRYPTED API DATA ===\n${extra}`;
        }
      }
    }

    const result: KnowledgeLiveFetchResult = {
      title: extractedTitle || 'External Live Knowledge Page',
      url,
      query,
      extractedContent:
        extractedContent ||
        'No readable text extracted from target page (browser).',
      structuredData,
      durationMs: Date.now() - startTime,
      extractedAt: new Date().toISOString(),
    };

    return result;
  }

  private extractTextFromHTML(html: string): string {
    // Strip script, style, noscript, etc.
    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '');

    // Extract text content
    const text = clean
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n');

    return text.trim();
  }
}
