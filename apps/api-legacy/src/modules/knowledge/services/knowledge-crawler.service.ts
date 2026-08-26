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
    let resolvedUrl = url;

    // STEP 1: If it's a GitHub URL, try the Smart GitHub Resolver first
    if (this.isGitHubUrl(url)) {
      try {
        const ghResult = await this.resolveGitHubSmartContent(url);
        if (ghResult && ghResult.extractedContent && ghResult.extractedContent.length > 50) {
          this.logger.log(`[KnowledgeCrawler] Successfully resolved GitHub content via smart resolver (${ghResult.url})`);
          this.cache.set(cacheKey, { data: ghResult, timestamp: Date.now() });
          return ghResult;
        }
      } catch (err: any) {
        this.logger.debug(`[KnowledgeCrawler] GitHub smart resolver initial check skipped: ${err.message}`);
      }
    }

    // STEP 2: Direct HTTP Fetch with Realistic Headers & Turndown
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

      if (response.ok) {
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
      }
    } catch (err: any) {
      this.logger.warn(`[KnowledgeCrawler] Direct fetch failed: ${err.message}`);
    }

    // STEP 3: Multi-Step Heuristic Fallback Pipeline (if direct fetch gave 404, 403, or empty content)
    if (!extractedContent || extractedContent.trim().length < 50 || extractedContent.includes('404: Not Found')) {
      this.logger.log(`[KnowledgeCrawler] Activating Heuristic Fallback Pipeline for ${url}...`);

      // Heuristic Fallback 3A: Deep GitHub Tree Search
      if (this.isGitHubUrl(url)) {
        try {
          const ghFallback = await this.resolveGitHubSmartContent(url);
          if (ghFallback && ghFallback.extractedContent && ghFallback.extractedContent.length > 50) {
            this.cache.set(cacheKey, { data: ghFallback, timestamp: Date.now() });
            return ghFallback;
          }
        } catch (err: any) {
          this.logger.debug(`[KnowledgeCrawler] GitHub fallback search error: ${err.message}`);
        }
      }

      // Heuristic Fallback 3B: Search Engine Heuristic Discovery (DuckDuckGo Search)
      try {
        const searchFallback = await this.searchHeuristicFallback(url, query, format);
        if (searchFallback && searchFallback.extractedContent && searchFallback.extractedContent.length > 50) {
          this.logger.log(`[KnowledgeCrawler] Heuristic search successfully resolved content for ${url}`);
          this.cache.set(cacheKey, { data: searchFallback, timestamp: Date.now() });
          return searchFallback;
        }
      } catch (err: any) {
        this.logger.debug(`[KnowledgeCrawler] Search heuristic fallback error: ${err.message}`);
      }

      // Heuristic Fallback 3C: Headless Browser Rendering (for client-side JavaScript SPAs)
      try {
        this.logger.log(`[KnowledgeCrawler] Trying headless browser rendering fallback for ${url}...`);
        const browserFallback = await this.fetchWithBrowser(
          { url, query, format, timeout: userTimeout },
          startTime,
        );
        if (browserFallback && browserFallback.extractedContent && browserFallback.extractedContent.length > 50 && !browserFallback.extractedContent.includes('No readable text')) {
          this.cache.set(cacheKey, { data: browserFallback, timestamp: Date.now() });
          return browserFallback;
        }
      } catch (err: any) {
        this.logger.debug(`[KnowledgeCrawler] Browser fallback error: ${err.message}`);
      }
    }

    const result: KnowledgeLiveFetchResult = {
      title: extractedTitle || 'External Live Knowledge Page',
      url: resolvedUrl,
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

  private isGitHubUrl(url: string): boolean {
    return /github\.com|raw\.githubusercontent\.com/i.test(url);
  }

  /**
   * Smart GitHub Tree & Raw Content Resolver.
   * Auto-resolves tree/blob URLs, subfolder repositionings (e.g. skills/productivity/grill-me),
   * and queries the public GitHub API/raw endpoints for 100% accurate file recovery.
   */
  private async resolveGitHubSmartContent(url: string): Promise<KnowledgeLiveFetchResult | null> {
    const startTime = Date.now();
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;

      const owner = parts[0];
      const repo = parts[1];
      let branch = 'main';
      let subpathParts: string[] = [];

      if (parts[2] === 'tree' || parts[2] === 'blob') {
        branch = parts[3] || 'main';
        subpathParts = parts.slice(4);
      } else if (parts.length > 2) {
        subpathParts = parts.slice(2);
      }

      const targetPath = subpathParts.join('/');
      const targetKeyword = subpathParts[subpathParts.length - 1] || repo;

      this.logger.log(`[KnowledgeCrawler] Resolving GitHub smart content for ${owner}/${repo} (target: ${targetPath || 'root'})`);

      // 1. Candidate raw URLs to try directly
      const candidates = [
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${targetPath}`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${targetPath}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${targetPath}/README.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/productivity/${targetPath}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/productivity/${targetKeyword}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${targetKeyword}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/skills/productivity/${targetKeyword}/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
      ];

      for (const candUrl of candidates) {
        if (!candUrl.endsWith('/') && !candUrl.endsWith('.git')) {
          try {
            const res = await fetch(candUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });
            if (res.ok) {
              const text = await res.text();
              if (text && text.trim().length > 40 && !text.includes('404: Not Found')) {
                return {
                  title: `${owner}/${repo}: ${targetKeyword || 'docs'} (Resolved via GitHub Smart Resolver)`,
                  url: candUrl,
                  query: targetPath,
                  extractedContent: `# ${owner}/${repo} — ${targetKeyword}\n*Source: ${candUrl}*\n\n${text.trim()}`,
                  structuredData: { method: 'github-smart-raw', owner, repo, resolvedUrl: candUrl },
                  durationMs: Date.now() - startTime,
                  extractedAt: new Date().toISOString(),
                };
              }
            }
          } catch {}
        }
      }

      // 2. Query GitHub Recursive Tree API to locate repositioned files
      try {
        const treeApiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        const treeRes = await fetch(treeApiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });

        if (treeRes.ok) {
          const treeData = (await treeRes.json()) as { tree?: Array<{ path: string; type: string }> };
          const files = treeData.tree || [];

          // Find best matching path (e.g. matching targetKeyword and SKILL.md/README.md)
          const matched = files.find(
            (f) =>
              f.type === 'blob' &&
              f.path.toLowerCase().includes(targetKeyword.toLowerCase()) &&
              (f.path.endsWith('.md') || f.path.endsWith('.txt') || f.path.endsWith('.json')),
          );

          if (matched) {
            const directRawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${matched.path}`;
            const fileRes = await fetch(directRawUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });
            if (fileRes.ok) {
              const fileText = await fileRes.text();
              if (fileText && fileText.trim().length > 40) {
                return {
                  title: `${owner}/${repo}: ${matched.path} (Discovered via Tree Index)`,
                  url: directRawUrl,
                  query: targetKeyword,
                  extractedContent: `# ${owner}/${repo} — ${matched.path}\n*Auto-discovered via GitHub Tree index*\n\n${fileText.trim()}`,
                  structuredData: { method: 'github-tree-discovery', matchedPath: matched.path },
                  durationMs: Date.now() - startTime,
                  extractedAt: new Date().toISOString(),
                };
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.debug(`[KnowledgeCrawler] GitHub Tree API lookup skipped: ${err.message}`);
      }
    } catch (err: any) {
      this.logger.warn(`[KnowledgeCrawler] GitHub Smart Resolver error: ${err.message}`);
    }

    return null;
  }

  /**
   * Search Heuristic Fallback (Zero API Key Dependency).
   * Queries public web search engines to discover live working alternatives when a URL fails.
   */
  private async searchHeuristicFallback(
    failedUrl: string,
    query: string,
    format: string,
  ): Promise<KnowledgeLiveFetchResult | null> {
    const startTime = Date.now();
    try {
      // Build clean search query from URL terms + query
      const urlObj = new URL(failedUrl);
      const pathTerms = urlObj.pathname.split(/[\/\-_]/).filter((p) => p && p.length > 2 && !['tree', 'blob', 'main', 'master', 'html'].includes(p)).join(' ');
      const searchQuery = query || `${urlObj.hostname.replace('www.', '')} ${pathTerms}`.trim();

      if (!searchQuery) return null;

      this.logger.log(`[KnowledgeCrawler] Running search heuristic fallback for query: "${searchQuery}"`);

      // Search via DuckDuckGo HTML endpoint
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) return null;

      const html = await res.text();
      // Extract result URLs and snippets
      const linkRegex = /<a[^>]+class="result__url"[^>]+href="([^"]+)"/gi;
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

      const foundUrls: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null && foundUrls.length < 3) {
        let candidate = match[1];
        // Decode DuckDuckGo redirect URL if applicable
        if (candidate.includes('uddg=')) {
          const parsedUddg = candidate.match(/uddg=([^&]+)/);
          if (parsedUddg) candidate = decodeURIComponent(parsedUddg[1]);
        }
        if (candidate.startsWith('http')) {
          foundUrls.push(candidate);
        }
      }

      // Collect snippets
      const snippets: string[] = [];
      while ((match = snippetRegex.exec(html)) !== null && snippets.length < 4) {
        snippets.push(this.extractTextFromHTML(match[1]));
      }

      if (foundUrls.length > 0 || snippets.length > 0) {
        const topUrl = foundUrls[0] || failedUrl;
        let contentBody = snippets.join('\n\n');

        // Attempt to fetch the top alternative URL if different from failedUrl
        if (topUrl && topUrl !== failedUrl) {
          try {
            const pageRes = await fetch(topUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });
            if (pageRes.ok) {
              const rawHtml = await pageRes.text();
              const md = turndownService.turndown(rawHtml);
              if (md && md.length > 100) {
                contentBody = md.slice(0, 15000);
              }
            }
          } catch {}
        }

        return {
          title: `Search Result: ${searchQuery} (Heuristic Fallback)`,
          url: topUrl,
          query: searchQuery,
          extractedContent: `# Live Web Discovery for "${searchQuery}"\n*Original URL: ${failedUrl}*\n*Alternative source: ${topUrl}*\n\n${contentBody}`,
          structuredData: { method: 'search-heuristic-fallback', alternativeUrls: foundUrls },
          durationMs: Date.now() - startTime,
          extractedAt: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      this.logger.warn(`[KnowledgeCrawler] Search heuristic fallback failed: ${err.message}`);
    }

    return null;
  }
}
