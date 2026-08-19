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
   * Collects captures and extracts secrets for the host.
   */
  async collect(page: Page, host: string): Promise<{ encrypted: string[]; decrypted: string[] }> {
    const result = { encrypted: [] as string[], decrypted: [] as string[] };
    try {
      const captures = await page.evaluate(() => (window as any).__arunakiCrypto || []);
      for (const c of captures) {
        if (c.type === 'encrypted') result.encrypted.push(c.body);
        if (c.type === 'decrypted') result.decrypted.push(c.sample);
        if (c.type === 'secret') {
          this.hostSecrets.set(host, { secret: c.secret, iterations: c.iterations || 1000, keySize: c.keySize || 12 });
          this.logger.log(`[CryptoHarvester] Captured decrypt secret for ${host} (${c.secret.slice(0, 8)}...)`);
        }
      }
    } catch {
      // page already closed — nothing to collect
    }
    return result;
  }

  hasSecret(host: string): boolean {
    return this.hostSecrets.has(host);
  }

  getSecret(host: string): { secret: string; iterations: number; keySize: number } | undefined {
    return this.hostSecrets.get(host);
  }
}
