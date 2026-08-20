import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import type { Page } from 'playwright';

/**
 * CryptoHarvesterService — generic client-side decryption capture.
 *
 * Persists learned site entries to `memories` table (type='site') so they
 * survive server restarts. One browser interaction per host is enough;
 * subsequent stock_lookup calls use the cached API template + secret.
 */
@Injectable()
export class CryptoHarvesterService implements OnModuleInit {
  private readonly logger = new Logger(CryptoHarvesterService.name);

  private hostSecrets = new Map<
    string,
    { secret: string; iterations: number; keySize: number }
  >();

  private learnedSites = new Map<
    string,
    {
      host: string;
      apiUrlTemplate: string;
      secret: string;
      iterations: number;
      keySizeBytes: number;
    }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.memory.findMany({
      where: { type: 'site', active: true },
    });
    for (const row of rows) {
      try {
        const data = JSON.parse(row.content);
        this.learnedSites.set(row.key, {
          host: row.key,
          apiUrlTemplate: data.apiUrlTemplate,
          secret: data.secret,
          iterations: data.iterations,
          keySizeBytes: data.keySizeBytes,
        });
        this.hostSecrets.set(row.key, {
          secret: data.secret,
          iterations: data.iterations,
          keySize: data.keySizeBytes / 4,
        });
      } catch {}
    }
    if (rows.length)
      this.logger.log(
        `[CryptoHarvester] Loaded ${rows.length} learned site(s) from DB`,
      );
  }

  getLearnedSite(host: string) {
    return this.learnedSites.get(host);
  }

  private readonly HOOK_SCRIPT = `
    (() => {
      const captures = (window.__arunakiCrypto = window.__arunakiCrypto || []);
      const cap = (o) => {
        try { captures.push(o); if (captures.length > 60) captures.shift(); } catch {}
      };

      const origFetch = window.fetch;
      window.fetch = function (...args) {
        return origFetch.apply(this, args).then(async (res) => {
          try {
            const ct = (res.headers.get('content-type') || '');
            if (ct.includes('json') && res.clone) {
              const t = await res.clone().text();
              if (t.includes('"encrypt"')) cap({ type: 'encrypted', url: String(args[0]).slice(0, 300), body: t.slice(0, 20000) });
            }
          } catch {}
          return res;
        });
      };

      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__arunakiUrl = String(url);
        return origOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', () => {
          try {
            const t = this.responseText;
            if (t && t.includes('"encrypt"')) cap({ type: 'encrypted', url: (this.__arunakiUrl || '').slice(0, 300), body: t.slice(0, 20000) });
          } catch {}
        });
        return origSend.apply(this, args);
      };

      const origParse = JSON.parse;
      JSON.parse = function (text, reviver) {
        let result;
        try { result = origParse.call(this, text, reviver); } catch (e) { throw e; }
        try {
          if (typeof text === 'string' && text.length > 20 && text.length < 500000) {
            cap({ type: 'decrypted', sample: text.slice(0, 30000) });
          }
        } catch {}
        return result;
      };

      const hookCjs = (root) => {
        const cjs = root.CryptoJS || root.cryptojs;
        if (!cjs) return;
        const origP = cjs.PBKDF2;
        if (origP) {
          cjs.PBKDF2 = function (passphrase, salt, cfg) {
            try {
              if (typeof passphrase === 'string' && passphrase.length > 10) {
                cap({ type: 'secret', secret: passphrase, iterations: cfg && cfg.iterations, keySize: cfg && cfg.keySize });
              }
            } catch {}
            return origP.apply(this, arguments);
          };
        }
      };
      hookCjs(window);
      try { hookCjs(globalThis); } catch {}
    })();
  `;

  async install(page: Page): Promise<void> {
    try {
      await page.addInitScript(this.HOOK_SCRIPT);
    } catch (err: any) {
      this.logger.warn(`[CryptoHarvester] hook install failed: ${err.message}`);
    }
  }

  async collect(
    page: Page,
    host: string,
  ): Promise<{
    encrypted: { url: string; body: string }[];
    decrypted: string[];
  }> {
    const result = {
      encrypted: [] as { url: string; body: string }[],
      decrypted: [] as string[],
    };
    try {
      const captures = await page.evaluate(
        () => (window as any).__arunakiCrypto || [],
      );
      for (const c of captures) {
        if (c.type === 'encrypted')
          result.encrypted.push({ url: c.url || '', body: c.body });
        if (c.type === 'decrypted') result.decrypted.push(c.sample);
        if (c.type === 'secret') {
          this.hostSecrets.set(host, {
            secret: c.secret,
            iterations: c.iterations || 1000,
            keySize: c.keySize || 12,
          });
          this.logger.log(
            `[CryptoHarvester] Captured decrypt secret for ${host} (${c.secret.slice(0, 8)}...)`,
          );
        }
      }
      await this.learnFromCaptures(host, page.url(), result);
    } catch {}
    return result;
  }

  async learnFromCaptures(
    host: string,
    pageUrl: string,
    captures: {
      encrypted: { url: string; body: string }[];
      decrypted: string[];
    },
    secret?: { secret: string; iterations: number; keySize: number },
  ): Promise<boolean> {
    if (this.learnedSites.has(host)) return false;
    const sec = secret || this.hostSecrets.get(host);
    if (!sec) return false;

    const stockCall = captures.encrypted.find((c) =>
      /\/stock\/\d+\/[^/?]+/.test(c.url),
    );
    if (!stockCall) return false;

    const hasStockPayload = captures.decrypted.some(
      (s) => this.stockPayloadsFrom([s]).length > 0,
    );
    if (!hasStockPayload) return false;

    const abs = stockCall.url.startsWith('http')
      ? stockCall.url
      : `https://${host}${stockCall.url}`;
    const template = abs.replace(
      /\/stock\/\d+\/[^/?]+/,
      '/stock/{productId}/{city}',
    );
    const entry = {
      host,
      apiUrlTemplate: template,
      secret: sec.secret,
      iterations: sec.iterations,
      keySizeBytes: sec.keySize * 4,
    };
    this.learnedSites.set(host, entry);
    this.hostSecrets.set(host, {
      secret: sec.secret,
      iterations: sec.iterations,
      keySize: sec.keySize,
    });

    // Persist to DB
    try {
      const json = JSON.stringify(entry);
      const existing = await this.prisma.memory.findFirst({
        where: { type: 'site', key: host },
      });
      if (existing) {
        await this.prisma.memory.update({
          where: { id: existing.id },
          data: { content: json, active: true },
        });
      } else {
        await this.prisma.memory.create({
          data: {
            type: 'site',
            key: host,
            content: json,
            source: 'auto',
            importance: 8,
          },
        });
      }
      this.logger.log(`[CryptoHarvester] Persisted site ${host} to DB`);
    } catch (e: any) {
      this.logger.warn(
        `[CryptoHarvester] Failed to persist site ${host}: ${e.message}`,
      );
    }

    this.logger.log(
      `[CryptoHarvester] Learned stock API for ${host}: ${template}`,
    );
    return true;
  }

  stockPayloadsFrom(samples: string[]): any[] {
    const rows: any[] = [];
    for (const s of samples) {
      try {
        const j = JSON.parse(s);
        if (!Array.isArray(j)) continue;
        const items = j.flatMap((b: any) =>
          Array.isArray(b?.products) ? b.products : [b],
        );
        for (const p of items) {
          if (
            typeof p?.stock === 'number' &&
            typeof p?.color === 'string' &&
            typeof p?.size === 'string'
          ) {
            rows.push(p);
          }
        }
      } catch {}
    }
    return rows;
  }

  hasSecret(host: string): boolean {
    return this.hostSecrets.has(host);
  }

  getSecret(host: string) {
    return this.hostSecrets.get(host);
  }
}
