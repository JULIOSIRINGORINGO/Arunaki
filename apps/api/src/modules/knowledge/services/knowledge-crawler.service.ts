import { Injectable, Logger } from '@nestjs/common';
import TurndownService from 'turndown';

export interface KnowledgeLiveFetchOptions {
  url: string;
  query?: string;
  format?: 'text' | 'markdown' | 'html';
  timeout?: number;
  filters?: Record<string, any>;
  selector?: string;
  browser?: boolean;
  stockLocation?: string;
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
  private cache = new Map<string, { data: KnowledgeLiveFetchResult; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  async fetchLiveKnowledge(options: KnowledgeLiveFetchOptions): Promise<KnowledgeLiveFetchResult> {
    const startTime = Date.now();
    const { url, query = '', format = 'markdown', timeout: userTimeout, browser, stockLocation } = options;

    const cacheKey = `${url}|${query}|${format}|browser=${!!browser}|loc=${stockLocation ?? ''}`.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.log(`[KnowledgeCrawler] Cache hit for ${url} (0ms)`);
      return cached.data;
    }

    // Browser path: JS-rendered data (e.g. stock per location) — HTTP cannot see it.
    if (browser) {
      const result = await this.fetchWithBrowser({ url, query, format, timeout: userTimeout, stockLocation }, startTime);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
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

  /**
   * Browser path: Playwright renders the page and runs the interaction needed
   * for JS-only data. Generic fallback for SPA content; stock-table flow for
   * cititex.com product pages (Pesanan Grosir drawer → pick city → stock per store).
   */
  private async fetchWithBrowser(
    options: KnowledgeLiveFetchOptions,
    startTime: number,
  ): Promise<KnowledgeLiveFetchResult> {
    const { url, query = '', format = 'markdown', stockLocation } = options;
    this.logger.log(`[KnowledgeCrawler] Browser fetch: ${url}`);

    let extractedTitle = '';
    let extractedContent = '';

    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);

        extractedTitle = (await page.title()) || url;

        // cititex product pages: open wholesale drawer to reveal stock per location
        if (/cititex\.com/.test(url) && /\/product\//.test(url)) {
          await page.evaluate(() => {
            const els = [...document.querySelectorAll<HTMLElement>('div,button,span,a')];
            const btn = els.find(e => (e.textContent || '').trim() === 'Pesanan Grosir' && e.offsetParent);
            if (btn) btn.click();
          });
          await page.waitForTimeout(2000);

          const city = stockLocation || this.extractLocationFromUrl(url) || 'Medan';

          await page.evaluate(() => {
            const drawer = document.querySelector<HTMLElement>('[class*=MuiDrawer-paper]');
            if (!drawer) return;
            const btn = [...drawer.querySelectorAll<HTMLElement>('button')].find(b => (b.textContent || '').includes('Locations'));
            if (btn) btn.click();
          });
          await page.waitForTimeout(2000);

          await page.evaluate((cityName: string) => {
            const pops = [...document.querySelectorAll<HTMLElement>('[class*=MuiPopover-root]')];
            const pop = pops.find(p => p.innerText.includes('Pilih Semua Lokasi'));
            if (!pop) return;
            const els = [...pop.querySelectorAll<HTMLElement>('div,li,a,button,span')].filter(e => (e.textContent || '').trim() === cityName);
            if (els.length) {
              const t = els[els.length - 1];
              t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              t.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
          }, city);
          await page.waitForTimeout(3500);
        }

        const drawerText = await page.evaluate(() => {
          const drawer = document.querySelector<HTMLElement>('[class*=MuiDrawer-paper]');
          return drawer ? drawer.innerText : '';
        });
        const bodyText = await page.evaluate(() => document.body.innerText);

        if (format === 'html') {
          extractedContent = await page.content();
        } else {
          extractedContent = [drawerText, bodyText].filter(t => t && t.trim()).join('\n\n---\n\n');
        }
      } finally {
        await browser.close();
      }
    } catch (err: any) {
      this.logger.warn(`[KnowledgeCrawler] Browser error: ${err.message}`);
    }

    const result: KnowledgeLiveFetchResult = {
      title: extractedTitle || 'External Live Knowledge Page',
      url,
      query,
      extractedContent: extractedContent || 'No readable text extracted from target page (browser).',
      structuredData: {
        url,
        format,
        method: 'browser',
        browser: 'playwright-chromium',
      },
      durationMs: Date.now() - startTime,
      extractedAt: new Date().toISOString(),
    };

    return result;
  }

  private extractLocationFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const loc = parsed.searchParams.get('location');
      return loc ? decodeURIComponent(loc) : null;
    } catch {
      return null;
    }
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
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('\n');

    return text.trim();
  }
}
