import { Injectable, Logger } from '@nestjs/common';
import { Tool, ToolDefinition } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

const crypto = require('crypto');

/**
 * StockLookupTool — real-time stock lookup via the site's own API.
 *
 * Many e-commerce sites expose stock data through JSON APIs whose responses
 * are encrypted client-side (CryptoJS). This tool calls the API directly and
 * decrypts using the site's own secret (extracted from its public JS bundle).
 *
 * Supported sites are registered in STOCK_SITES. Unknown sites fall back to
 * browser_interaction (generic clicking), which the LLM handles.
 */
@Injectable()
export class StockLookupTool implements Tool {
  private readonly logger = new Logger(StockLookupTool.name);

  // host -> { apiPattern, secret, keyBytes (pbkdf2 derived length), idFromUrl }
  private readonly STOCK_SITES: Record<
    string,
    {
      apiUrl: (productId: string, city: string) => string;
      secret: string;
      keySizeBytes: number; // PBKDF2 derived length in bytes (12 words = 48)
      parseId: (url: string) => string;
    }
  > = {
    'cititex.com': {
      apiUrl: (productId, city) =>
        `https://cititex.com/api/userapi/category/stock/${productId}/${encodeURIComponent(city)}?isWholesale=true`,
      // extracted from cititex.com JS bundle (public client-side key)
      secret: 'swWS4eZh6niL5SRzlQiPcRNAvh9SyRdPvGug9g6zhPmycTEIlKp8lcCzqRcNcKS2',
      keySizeBytes: 48,
      parseId: (url) => {
        const m = url.match(/-(\d+)(\?|$)/);
        return m ? m[1] : '';
      },
    },
  };

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
      tags: ['stock', 'inventory', 'availability', 'ecommerce'],
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Product page URL (used to identify the site and product)' },
          city: { type: 'string', description: 'City name, e.g. Medan, Jakarta. Use ip_geolocation first if unknown.' },
          color: { type: 'string', description: 'Optional: color filter, e.g. Red, White' },
          size: { type: 'string', description: 'Optional: size filter, e.g. S, M, L, XL' },
        },
        required: ['url', 'city'],
      },
      outputType: 'text' as const,
      estimatedLatency: 'fast' as const,
    };
  }

  get description(): string {
    return 'Fetches real-time stock from supported e-commerce sites by calling their own API directly (no browser). Input: product URL + city. Returns per-branch stock per color/size with prices. Use ip_geolocation to determine the user city first. If the site is unsupported, use browser_interaction instead.';
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
    return 20000;
  }

  async execute(args: { url: string; city: string; color?: string; size?: string }): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const host = new URL(args.url).hostname;
      const site = this.STOCK_SITES[host];
      if (!site) {
        return {
          status: 'error',
          data: {},
          preview: `stock_lookup does not support ${host}. Use browser_interaction instead.`,
          metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - startTime },
          error: { code: 'UNSUPPORTED_SITE', message: `No stock API known for ${host}` },
        };
      }

      const productId = site.parseId(args.url);
      if (!productId) {
        throw new Error(`Could not extract product id from URL: ${args.url}`);
      }

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

      const stockData = JSON.parse(this.decrypt(json.encrypt, site.secret, site.keySizeBytes));

      // Summarize per branch
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

      if (rows.length === 0) {
        return {
          status: 'success',
          data: { city: args.city, productId },
          preview: `No stock found for ${args.color || 'any color'} ${args.size || 'any size'} in ${args.city}.`,
          metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - startTime },
        };
      }

      const preview = `Stock in ${args.city} (${args.color || 'all colors'} / ${args.size || 'all sizes'}):\n` + rows.join('\n');
      return {
        status: 'success',
        data: { city: args.city, productId, branches: rows },
        preview,
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

  private decrypt(b64: string, secret: string, keySizeBytes: number): string {
    const buf = Buffer.from(b64, 'base64');
    const salt = buf.subarray(0, 16);
    const cipher = buf.subarray(16);
    const derived = crypto.pbkdf2Sync(secret, salt, 1000, keySizeBytes, 'sha256');
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32);
    const dec = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([dec.update(cipher), dec.final()]).toString('utf8');
  }
}