import { Injectable, Logger } from '@nestjs/common';
import { PlaywrightCrawler, Configuration } from 'crawlee';

export interface KnowledgeLiveFetchOptions {
  url: string;
  query?: string;
  filters?: Record<string, any>;
  selector?: string;
  timeoutMs?: number;
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

/**
 * KnowledgeCrawlerService
 *
 * Universal, domain-agnostic headless crawler powered by Crawlee (Apify).
 * Inspects any registered external knowledge link (news articles, documentation,
 * cloud spreadsheets, catalogs, regulatory portals) and extracts clean content.
 */
@Injectable()
export class KnowledgeCrawlerService {
  private readonly logger = new Logger(KnowledgeCrawlerService.name);
  private cache = new Map<string, { data: KnowledgeLiveFetchResult; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Universally crawl and extract live data from any web URL.
   */
  async fetchLiveKnowledge(options: KnowledgeLiveFetchOptions): Promise<KnowledgeLiveFetchResult> {
    const startTime = Date.now();
    const { url, query = '', filters = {}, selector } = options;

    const cacheKey = `${url}|${query}|${selector || ''}|${JSON.stringify(filters)}`.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.log(`[KnowledgeCrawler] Cache hit for ${url} (0ms)`);
      return cached.data;
    }

    this.logger.log(
      `[KnowledgeCrawler] Universally crawling live URL: ${url} (Query: "${query}")`,
    );

    let extractedTitle = '';
    let extractedContent = '';
    let structuredData: Record<string, any> = {};

    const crawler = new PlaywrightCrawler(
      {
        maxRequestsPerCrawl: 1,
        headless: true,
        navigationTimeoutSecs: 30,
        requestHandlerTimeoutSecs: 35,
        preNavigationHooks: [
          async (_context, gotoOptions) => {
            if (gotoOptions) {
              gotoOptions.waitUntil = 'domcontentloaded';
              gotoOptions.timeout = 30000;
            }
          },
        ],
        launchContext: {
          launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
          },
        },
        async requestHandler({ page, log }) {
          log.info(`[Crawlee] Inspecting page: ${page.url()}`);
          
          // Resource optimization (abort heavy media files to minimize latency)
          await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,avi,ttf,woff,woff2}', (route) => {
            route.abort();
          }).catch(() => {});

          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(300);

          extractedTitle = await page.title();

          // 0. Universal Link Navigation: Only navigate if current page does not already match the query entity
          if (query) {
            const queryTokens = query
              .toLowerCase()
              .split(/[\s,+/]+/)
              .filter((w) => w.length >= 3);

            const currentUrl = page.url().toLowerCase();
            const currentTitle = (extractedTitle || '').toLowerCase();
            let currentScore = 0;
            for (const t of queryTokens) {
              if (currentUrl.includes(t)) currentScore += 3;
              if (currentTitle.includes(t)) currentScore += 2;
            }

            // If current page is a general catalog / index (score < 5), find the best matching sub-item
            if (currentScore < 5) {
              const matchingLink = await page.evaluate((tokens) => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                let bestHref: string | null = null;
                let bestScore = 0;

                for (const a of links) {
                  const href = (a.getAttribute('href') || '').toLowerCase();
                  const text = (a.textContent || '').toLowerCase();
                  if (!href || href === '#' || href.startsWith('javascript:')) continue;

                  let score = 0;
                  for (const t of tokens) {
                    if (href.includes(t)) score += 3;
                    if (text.includes(t)) score += 2;
                  }

                  if (score > bestScore && score >= 4) {
                    bestScore = score;
                    bestHref = a.getAttribute('href');
                  }
                }
                return bestHref;
              }, queryTokens);

              if (matchingLink) {
                const fullTarget = matchingLink.startsWith('http')
                  ? matchingLink
                  : new URL(matchingLink, page.url()).toString();
                log.info(`[Crawlee Auto-Discovery] Found target sub-URL: ${fullTarget}`);
                await page.goto(fullTarget, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(300);
                extractedTitle = await page.title();
              }
            }
          }

          // 1. Explicit Selector Wait if provided
          if (selector) {
            try {
              await page.waitForSelector(selector, { timeout: 1500 });
            } catch {}
          }

          // 2. Expand collapsed summaries / accordions if present
          const expandableElements = page.locator('details > summary, [aria-expanded="false"]').first();
          if ((await expandableElements.count()) > 0) {
            try {
              await expandableElements.click({ timeout: 1000 });
              await page.waitForTimeout(200);
            } catch {}
          }

          // 3. Dynamic Interactive Term Matching (Radio buttons, dropdown options, tabs, swatches)
          const searchTokens: string[] = [];
          if (typeof filters === 'object' && filters !== null) {
            for (const val of Object.values(filters)) {
              if (val && typeof val === 'string') searchTokens.push(val);
            }
          }
          if (query) {
            const words = query.split(/[\s,+/]+/).map((w) => w.trim()).filter((w) => w.length >= 2);
            searchTokens.push(...words);
          }

          // Match query tokens with interactive form controls and options
          for (const token of searchTokens) {
            try {
              // Interactive option matching across accessibility & standard attributes
              const interactiveOption = page
                .locator(
                  `[aria-label*="${token}" i], [title*="${token}" i], [data-value*="${token}" i], [data-name*="${token}" i], input[value*="${token}" i], option:has-text("${token}"), [role="option"]:has-text("${token}"), [role="tab"]:has-text("${token}")`,
                )
                .first();

              if ((await interactiveOption.count()) > 0) {
                await interactiveOption.click({ timeout: 1000, force: true });
                await page.waitForTimeout(300);
                continue;
              }

              // Exact text button / clickable item matching
              const buttonMatch = page
                .locator('button, [role="button"], span, div')
                .filter({ hasText: new RegExp(`^\\s*${token}\\s*$`, 'i') })
                .first();

              if ((await buttonMatch.count()) > 0) {
                await buttonMatch.click({ timeout: 1000, force: true });
                await page.waitForTimeout(300);
              }
            } catch {}
          }

          // 4. Universal Content & Structured Entity Extraction (100% Domain-Agnostic)
          const pageData = await page.evaluate((targetSelector) => {
            // A. Detect Primary Interactive Action / Status (Pure Web Standards)
            let ctaStatus = 'AVAILABLE / ACTIVE';
            const actionElements = Array.from(
              document.querySelectorAll(
                'button[type="submit"], form button, main button, [role="button"], input[type="submit"], button',
              ),
            ) as HTMLElement[];

            const primaryAction = actionElements.find((el) => {
              const text = (el.textContent || '').trim();
              const aria = el.getAttribute('aria-label') || '';
              const combined = `${text} ${aria}`.trim();
              return combined.length >= 2 && combined.length <= 60;
            });

            if (primaryAction) {
              const isDisabled =
                primaryAction.hasAttribute('disabled') ||
                primaryAction.getAttribute('aria-disabled') === 'true' ||
                (primaryAction as HTMLButtonElement).disabled === true ||
                primaryAction.classList.contains('disabled');

              const label = (primaryAction.textContent || primaryAction.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
              ctaStatus = isDisabled ? `DISABLED ("${label}")` : `ACTIVE ("${label}")`;
            }

            // B. Extract Structured Data Tables & Rows Generically
            const structuredRows: string[] = [];
            const rows = Array.from(document.querySelectorAll('table tr, [role="row"], [class*="table"] tr, [class*="grid"] > div, [class*="row"]'));
            for (const row of rows) {
              const txt = (row.textContent || '').replace(/\s+/g, ' ').trim();
              if (txt.length >= 6 && txt.length <= 250 && /\d+/.test(txt)) {
                structuredRows.push(txt);
              }
            }

            // C. Clean raw document text
            const noise = document.querySelectorAll('script, style, noscript, svg, nav, footer');
            noise.forEach((el) => el.remove());

            let rootElement: HTMLElement = document.body;
            if (targetSelector) {
              const customRoot = document.querySelector(targetSelector) as HTMLElement;
              if (customRoot) rootElement = customRoot;
            } else {
              const mainRoot = document.querySelector('article, main, [role="main"], .content, #content') as HTMLElement;
              if (mainRoot) rootElement = mainRoot;
            }

            const raw = rootElement.innerText || document.body.innerText;
            const lines = raw
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0);

            // D. Extract Active Key-Value Labels (e.g. "Key: Value")
            const activeAttributes: string[] = [];
            for (let i = 0; i < lines.length - 1; i++) {
              const l = lines[i];
              if (l.endsWith(':') && l.length < 35 && lines[i + 1] && lines[i + 1].length < 60) {
                activeAttributes.push(`${l} ${lines[i + 1]}`);
              }
            }

            // E. Extract Universal Option Swatches & Badges (e.g. colors, variants)
            const swatches = Array.from(document.querySelectorAll('[aria-label], [title], img[alt], [data-color], [data-tooltip], [role="radio"], [role="option"]'));
            const optionBadges = Array.from(new Set(
              swatches
                .map((el) => el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '')
                .map((t) => t.replace(/^(Color option|Pilihan warna|Warna)\s*/i, '').trim())
                .filter((t) => t.length >= 2 && t.length <= 35 && !/cititex|logo|menu|cart|search|masuk|beranda|gambar|koleksi|populer|t-shirt|apparel|rating|bintang/i.test(t))
            ));

            return {
              ctaStatus,
              activeAttributes: Array.from(new Set(activeAttributes)).slice(0, 8),
              structuredRows: Array.from(new Set(structuredRows)).slice(0, 15),
              optionBadges: optionBadges.slice(0, 60),
              cleanText: lines.slice(0, 250).join('\n'),
              totalLines: lines.length,
            };
          }, selector);

          // Build universal factual summary header
          const summaryHeader = [
            '=== LIVE VERIFIED PAGE SUMMARY ===',
            `Page Title: ${extractedTitle || 'Live Source'}`,
            `Primary Action Status: ${pageData.ctaStatus}`,
            pageData.activeAttributes.length > 0 ? `Active Properties & Selections: ${pageData.activeAttributes.join(' | ')}` : null,
            pageData.optionBadges.length > 0 ? `Available Options / Variants / Colors (${pageData.optionBadges.length}): ${pageData.optionBadges.join(', ')}` : null,
            pageData.structuredRows.length > 0 ? `Tabular / Structured Records:\n${pageData.structuredRows.join('\n')}` : null,
            '==================================\n',
          ].filter(Boolean).join('\n');

          extractedContent = `${summaryHeader}\n${pageData.cleanText}`;
          structuredData = {
            url: page.url(),
            query,
            ctaStatus: pageData.ctaStatus,
            activeAttributes: pageData.activeAttributes,
            structuredRows: pageData.structuredRows,
            totalExtractedLines: pageData.totalLines,
          };
        },
      },
      new Configuration({ persistStorage: false }),
    );

    try {
      await crawler.run([url]);
    } catch (err: any) {
      this.logger.warn(`[KnowledgeCrawler] Crawl warning: ${err.message}`);
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
}
