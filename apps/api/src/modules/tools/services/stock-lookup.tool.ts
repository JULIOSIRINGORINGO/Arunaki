import { Injectable, Logger, Optional } from '@nestjs/common';
import { Tool, ToolDefinition } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { CryptoHarvesterService } from '../../knowledge/services/crypto-harvester.service.js';

const crypto = require('crypto');

/**
 * StockLookupTool — real-time stock lookup for ANY vendor product URL.
 *
 * No vendor is hardcoded here. Two paths:
 *
 * 1. Auto-learned direct API — CryptoHarvesterService captures the site's own
 *    decrypt secret + /stock/{id}/{city} endpoint while the browser is on the
 *    page (client-side keys are public). Once learned, stock_lookup calls the
 *    site's API directly and decrypts offline.
 *
 * 2. Browser read — for any other site, render the product page and read
 *    stock from the page itself (decrypted API payloads, SSR JSON, visible
 *    text). Works with any URL a user registers in a knowledge node.
 *
 * Both paths are per-site knowledge-free: the site config never lives in code.
 */
@Injectable()
export class StockLookupTool implements Tool {
  private readonly logger = new Logger(StockLookupTool.name);

  constructor(
    @Optional() private readonly cryptoHarvester?: CryptoHarvesterService,
  ) {}

  get name(): string {
    return 'stock_lookup';
  }

  get displayName(): string {
    return 'Stock Lookup';
  }

  get capability() {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      tags: ['stock', 'inventory', 'availability', 'ecommerce', 'vendor', 'toko', 'stok', 'ready'],
      inputSchema: {
        url: 'Product page URL (works for any vendor, e.g. from knowledge nodes)',
        city: 'City name, e.g. Medan, Jakarta. Use ip_geolocation first if unknown.',
        color: 'Optional: color filter, e.g. Red, White',
        size: 'Optional: size filter, e.g. S, M, L, XL',
      },
      outputType: 'text' as const,
      estimatedLatency: 'medium' as const,
    };
  }

  get description(): string {
    return 'Fetches real-time stock from any product URL (any vendor): calls the site\'s own API when it was auto-learned, otherwise renders the product page and reads the stock from the page data. Input: product URL (e.g. from knowledge nodes) + city. Returns per-branch/variant stock with prices. Use ip_geolocation to determine the user city first.';
  }

  get definition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Product page URL' },
            city: { type: 'string', description: 'City name' },
            color: { type: 'string', description: 'Color filter (optional)' },
            size: { type: 'string', description: 'Size filter (optional)' },
          },
          required: ['url', 'city'],
        },
      },
    };
  }

  get isMutating(): boolean {
    return false;
  }

  get timeoutMs(): number {
    return 60000;
  }

  /**
   * Site registry comes only from CryptoHarvester auto-learned entries —
   * never hardcoded. Unknown hosts fall through to the browser read path.
   */
  private learnedSiteFor(host: string) {
    const learned = this.cryptoHarvester?.getLearnedSite(host);
    if (!learned) return undefined;
    return {
      apiUrl: (productId: string, city: string) =>
        learned.apiUrlTemplate.replace('{productId}', productId).replace('{city}', encodeURIComponent(city)),
      secret: learned.secret,
      keySizeBytes: learned.keySizeBytes,
      iterations: learned.iterations,
      parseId: (url: string) => {
        const m = url.match(/-(\d+)(\?|$)/);
        return m ? m[1] : '';
      },
    };
  }

  async execute(args: { url: string; city: string; color?: string; size?: string }): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const host = new URL(args.url).hostname;
      const site = this.learnedSiteFor(host);

      let rows: string[] = [];
      if (site) {
        rows = await this.lookupViaApi(args, site);
      } else {
        rows = await this.lookupViaBrowser(args);
      }

      if (rows.length === 0) {
        return {
          status: 'error',
          data: {},
          preview: `Could not find stock data on ${host}. If the stock is behind a login/click, use browser_interaction to open the page and read it manually.`,
          metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - startTime },
          error: { code: 'NO_STOCK_FOUND', message: `No stock data found on ${host}` },
        };
      }

      return {
        status: 'success',
        data: { city: args.city, host, rows },
        preview: `Stock in ${args.city} (${args.color || 'all colors'} / ${args.size || 'all sizes'}):\n` + rows.join('\n'),
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - startTime },
      };
    } catch (err: any) {
      this.logger.error(`[StockLookup] ${err.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Stock lookup failed: ${err.message}`,
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - startTime },
        error: { code: 'STOCK_LOOKUP_FAILED', message: err.message },
      };
    }
  }

  private async lookupViaApi(
    args: { url: string; city: string; color?: string; size?: string },
    site: {
      apiUrl: (productId: string, city: string) => string;
      secret: string;
      keySizeBytes: number;
      iterations: number;
      parseId: (url: string) => string;
    },
  ): Promise<string[]> {
    const productId = site.parseId(args.url);
    if (!productId) throw new Error(`Could not extract product id from URL: ${args.url}`);

    const apiUrl = site.apiUrl(productId, args.city);
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`API responded ${response.status}`);
    const json: any = await response.json();
    if (!json || typeof json.encrypt !== 'string') {
      throw new Error('API response is not encrypted (unexpected shape).');
    }

    const stockData = JSON.parse(this.decrypt(json.encrypt, site.secret, site.keySizeBytes, site.iterations || 1000));

    const rows: string[] = [];
    for (const branch of stockData) {
      const branchName = branch.name || branch.groupLocation || '?';
      const products = branch.products || [];
      const filtered = products.filter((p: any) =>
        (!args.color || p.color.toLowerCase() === args.color.toLowerCase()) &&
        (!args.size || p.size.toLowerCase() === args.size.toLowerCase()),
      );
      if (filtered.length === 0) continue;
      const parts = filtered.map((p: any) => `${p.color} ${p.size}: ${p.stock} Left (${p.price1.toLocaleString('id-ID')})`);
      rows.push(`${branchName}: ${parts.join(', ')}`);
    }
    return rows;
  }

  /**
   * Reads stock for any site by rendering the product page and collecting
   * evidence: decrypted API payloads (most structured), SSR JSON blobs,
   * then visible text. No per-site knowledge required.
   */
  private async lookupViaBrowser(args: { url: string; city: string; color?: string; size?: string }): Promise<string[]> {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      if (this.cryptoHarvester) await this.cryptoHarvester.install(page);

      // Many product pages only embed stock once color/size/location are
      // selected via query params — add them when missing (harmless elsewhere).
      const target = new URL(args.url);
      if (args.color && !target.searchParams.has('color')) target.searchParams.set('color', args.color);
      if (args.size && !target.searchParams.has('size')) target.searchParams.set('size', args.size);
      if (args.city && !target.searchParams.has('location')) target.searchParams.set('location', args.city);

      await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(4000);

      const rows: string[] = [];
      const seen = new Set<string>();
      const add = (row: string) => {
        if (!seen.has(row)) {
          seen.add(row);
          rows.push(row);
        }
      };

      // 1. structured decrypted payloads (best signal)
      if (this.cryptoHarvester) {
        const host = new URL(args.url).hostname;
        const captured = await this.cryptoHarvester.collect(page, host);
        for (const p of this.cryptoHarvester.stockPayloadsFrom(captured.decrypted)) {
          const price = typeof p.price1 === 'number' ? ` (${p.price1.toLocaleString('id-ID')})` : '';
          add(`${p.color} ${p.size}: ${p.stock} Left${price}`);
        }
      }

      // 2. SSR JSON blobs in the raw HTML
      const html = await page.content();
      for (const r of this.extractSsrRows(html)) add(r);

      // 3. visible text lines mentioning stock
      const text = await page.evaluate(() => document.body.innerText);
      for (const r of this.extractTextRows(text)) add(r);

      return this.filterRows(rows, args.color, args.size).slice(0, 40);
    } finally {
      await browser.close();
    }
  }

  /**
   * Scans raw HTML for JSON objects containing "stock":N and reconstructs
   * "Color Size: N Left" rows from color/size inside the SAME object.
   */
  private extractSsrRows(html: string): string[] {
    const rows: string[] = [];
    // SSR frameworks serialize JSON inside strings (\") — normalize so the
    // object regex can match both raw JSON and escaped JSON blobs.
    const norm = html.replace(/\\"/g, '"');
    const re = /\{"[^}]*?"stock"\s*:\s*(\d+)[^}]*\}/g;
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(norm)) !== null && guard++ < 200) {
      const obj = m[0];
      const color = obj.match(/"color"\s*:\s*"([^"]+)"/)?.[1];
      const size = obj.match(/"size"\s*:\s*"([^"]+)"/)?.[1];
      if (color && size) rows.push(`${color} ${size}: ${m[1]} Left`);
    }
    return rows;
  }

  /**
   * Picks readable lines that pair a number with a stock-ish word.
   */
  private extractTextRows(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length < 140 && /\d/.test(l) && /(left|habis|tersisa|ready|stok|stock)/i.test(l))
      .slice(0, 20);
  }

  private filterRows(rows: string[], color?: string, size?: string): string[] {
    return rows.filter((r) =>
      (!color || r.toLowerCase().includes(color.toLowerCase())) &&
      (!size || r.toLowerCase().includes(size.toLowerCase())),
    );
  }

  private decrypt(b64: string, secret: string, keySizeBytes: number, iterations = 1000): string {
    const buf = Buffer.from(b64, 'base64');
    const salt = buf.subarray(0, 16);
    const cipher = buf.subarray(16);
    const derived = crypto.pbkdf2Sync(secret, salt, iterations, keySizeBytes, 'sha256');
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32);
    const dec = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([dec.update(cipher), dec.final()]).toString('utf8');
  }
}