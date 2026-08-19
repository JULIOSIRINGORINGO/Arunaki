import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'playwright';

/**
 * CryptoHarvesterService — generic client-side decryption capture.
 *
 * Many e-commerce sites encrypt their API responses and decrypt them in the
 * browser (CryptoJS / WebCrypto). Instead of hardcoding per-site keys, this
 * service hooks the page's own runtime (fetch/XHR responses + JSON.parse) to
 * capture both the encrypted payloads and the decrypted data as they pass
 * through. Works for any site, no per-site knowledge required.
 *
 * Secondary path: if a site exposes CryptoJS on window (rare), the PBKDF2 /
 * AES hooks capture the secret + parameters, enabling offline decryption of
 * subsequent direct HTTP calls for the same host.
 */
@Injectable()
export class CryptoHarvesterService {
  private readonly logger = new Logger(CryptoHarvesterService.name);

  // host -> captured secrets from CryptoJS hooks (if exposed globally)
  private hostSecrets = new Map<string, { secret: string; iterations: number; keySize: number }>();

  // host -> learned stock API (auto-registered from captures, no per-site code)
  private learnedSites = new Map<
    string,
    { host: string; apiUrlTemplate: string; secret: string; iterations: number; keySizeBytes: number }
  >();

  getLearnedSite(host: string): { host: string; apiUrlTemplate: string; secret: string; iterations: number; keySizeBytes: number } | undefined {
    return this.learnedSites.get(host);
  }

  private readonly HOOK_SCRIPT = `
    (() => {
      const captures = (window.__arunakiCrypto = window.__arunakiCrypto || []);
      const cap = (o) => {
        try { captures.push(o); if (captures.length > 60) captures.shift(); } catch {}
      };

      // 1. Capture encrypted API responses (fetch + XHR)
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

      // 2. Capture decrypted data as it passes through JSON.parse
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

      // 3. If CryptoJS is exposed globally, capture secret + decrypt params
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

  /**
   * Installs hooks on a page. Call before goto. Returns a function to collect
   * everything captured during the session.
   */
  async install(page: Page): Promise<void> {
    try {
      await page.addInitScript(this.HOOK_SCRIPT);
    } catch (err: any) {
      this.logger.warn(`[CryptoHarvester] hook install failed: ${err.message}`);
    }
  }

  /**
   * Collects captures, extracts secrets, and tries to auto-learn the site's
   * stock API (endpoint template + secret) so stock_lookup can call it
   * directly without any per-site code.
   */
  async collect(
    page: Page,
    host: string,
  ): Promise<{ encrypted: { url: string; body: string }[]; decrypted: string[] }> {
    const result = { encrypted: [] as { url: string; body: string }[], decrypted: [] as string[] };
    try {
      const captures = await page.evaluate(() => (window as any).__arunakiCrypto || []);
      for (const c of captures) {
        if (c.type === 'encrypted') result.encrypted.push({ url: c.url || '', body: c.body });
        if (c.type === 'decrypted') result.decrypted.push(c.sample);
        if (c.type === 'secret') {
          this.hostSecrets.set(host, { secret: c.secret, iterations: c.iterations || 1000, keySize: c.keySize || 12 });
          this.logger.log(`[CryptoHarvester] Captured decrypt secret for ${host} (${c.secret.slice(0, 8)}...)`);
        }
      }
      this.learnFromCaptures(host, page.url(), result);
    } catch {
      // page already closed — nothing to collect
    }
    return result;
  }

  /**
   * Auto-learns the stock API of a host from captured traffic:
   * needs (1) a captured secret, (2) an encrypted request matching
   * /stock/{id}/{city}, and (3) a decrypted payload shaped like stock data.
   */
  learnFromCaptures(
    host: string,
    pageUrl: string,
    captures: { encrypted: { url: string; body: string }[]; decrypted: string[] },
    secret?: { secret: string; iterations: number; keySize: number },
  ): boolean {
    if (this.learnedSites.has(host)) return false;
    const sec = secret || this.hostSecrets.get(host);
    if (!sec) return false;

    const stockCall = captures.encrypted.find((c) => /\/stock\/\d+\/[^/?]+/.test(c.url));
    if (!stockCall) return false;

    const hasStockPayload = captures.decrypted.some((s) => this.stockPayloadsFrom([s]).length > 0);
    if (!hasStockPayload) return false;

    const abs = stockCall.url.startsWith('http') ? stockCall.url : `https://${host}${stockCall.url}`;
    const template = abs.replace(/\/stock\/\d+\/[^/?]+/, '/stock/{productId}/{city}');
    this.learnedSites.set(host, {
      host,
      apiUrlTemplate: template,
      secret: sec.secret,
      iterations: sec.iterations,
      keySizeBytes: sec.keySize * 4,
    });
    this.logger.log(`[CryptoHarvester] Learned stock API for ${host}: ${template}`);
    return true;
  }

  /**
   * Parses decrypted samples and returns flattened stock rows
   * (any array of {color, size, stock} objects, nested or flat).
   */
  stockPayloadsFrom(samples: string[]): any[] {
    const rows: any[] = [];
    for (const s of samples) {
      try {
        const j = JSON.parse(s);
        if (!Array.isArray(j)) continue;
        const items = j.flatMap((b: any) => (Array.isArray(b?.products) ? b.products : [b]));
        for (const p of items) {
          if (typeof p?.stock === 'number' && typeof p?.color === 'string' && typeof p?.size === 'string') {
            rows.push(p);
          }
        }
      } catch {
        // not JSON — skip
      }
    }
    return rows;
  }

  hasSecret(host: string): boolean {
    return this.hostSecrets.has(host);
  }

  getSecret(host: string): { secret: string; iterations: number; keySize: number } | undefined {
    return this.hostSecrets.get(host);
  }
}
