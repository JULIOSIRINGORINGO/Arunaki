import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface BrowserSession {
  context: BrowserContext;
  page: Page;
  createdAt: Date;
}

@Injectable()
export class BrowserInteractionService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserInteractionService.name);
  private browser: Browser | null = null;
  private sessions = new Map<string, BrowserSession>();
  private launchAttempted = false;

  async ensureBrowser(): Promise<void> {
    if (this.browser) return;
    if (this.launchAttempted) {
      throw new Error(
        'Browser previously failed to launch. Check that Chromium is installed ' +
          '(run: npx playwright install chromium) and restart the server.',
      );
    }
    this.launchAttempted = true;
    try {
      const executable = chromium.executablePath();
      this.logger.log(`Chromium path: ${executable}`);
    } catch {
      throw new Error(
        'Chromium browser not found. Install it with: npx playwright install chromium',
      );
    }
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      });
      this.logger.log('Browser launched successfully');
    } catch (err) {
      this.launchAttempted = false;
      throw new Error(
        `Failed to launch Chromium: ${err.message}. ` +
          'Ensure Chrome/Chromium is installed and try again.',
      );
    }
  }

  private validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: "${url}"`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `Blocked protocol: ${parsed.protocol} (only http/https allowed)`,
      );
    }
    const hostname = parsed.hostname.toLowerCase();
    const blocked = [
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
      /^192\.168\.\d{1,3}\.\d{1,3}$/,
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      /^localhost$/i,
      /^::1$/,
    ];
    for (const pattern of blocked) {
      if (pattern.test(hostname)) {
        throw new Error(
          `Blocked URL: cannot navigate to private network address (${hostname})`,
        );
      }
    }
  }

  private async getOrCreatePage(sessionId: string): Promise<Page> {
    await this.ensureBrowser();
    const existing = this.sessions.get(sessionId);
    if (existing) {
      try {
        if (existing.page.isClosed()) {
          this.sessions.delete(sessionId);
        } else {
          return existing.page;
        }
      } catch {
        this.sessions.delete(sessionId);
      }
    }
    const context = await this.browser!.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'id-ID',
    });
    await this.grantIpGeolocation(context);
    const page = await context.newPage();
    this.sessions.set(sessionId, { context, page, createdAt: new Date() });
    this.logger.log(`New page created for session: ${sessionId}`);
    return page;
  }

  private geoCache: { lat: number; lon: number } | null = null;
  private geoCachedAt = 0;
  private readonly GEO_CACHE_TTL_MS = 60 * 60 * 1000;

  // ponytail: config-driven default location injected into location-aware URLs.
  // ARUNAKI_DEFAULT_LOCATION=Medan & ARUNAKI_LOCATION_PARAM=location; UI will set these later.
  private readonly defaultLocation: string | null =
    process.env.ARUNAKI_DEFAULT_LOCATION || null;
  private readonly locationParam: string =
    process.env.ARUNAKI_LOCATION_PARAM || 'location';

  private injectLocationParam(url: string): string {
    if (!this.defaultLocation) return url;
    const parsed = new URL(url);
    const key = this.locationParam.toLowerCase();
    if ([...parsed.searchParams.keys()].some((k) => k.toLowerCase() === key))
      return url;
    parsed.searchParams.append(this.locationParam, this.defaultLocation);
    return parsed.toString();
  }

  /**
   * Grants geolocation and sets coordinates from the network IP, so sites that
   * ask for location (cititex etc.) resolve to the user's actual region.
   */
  private async grantIpGeolocation(context: BrowserContext): Promise<void> {
    try {
      if (
        !this.geoCache ||
        Date.now() - this.geoCachedAt > this.GEO_CACHE_TTL_MS
      ) {
        const res = await fetch('http://ip-api.com/json/?fields=lat,lon', {
          headers: { 'User-Agent': 'Arunaki/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (
          data.status === 'success' &&
          typeof data.lat === 'number' &&
          typeof data.lon === 'number'
        ) {
          this.geoCache = { lat: data.lat, lon: data.lon };
          this.geoCachedAt = Date.now();
          this.logger.log(`IP geolocation: ${data.lat},${data.lon}`);
        }
      }
      if (!this.geoCache) return;
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({
        latitude: this.geoCache.lat,
        longitude: this.geoCache.lon,
      });
    } catch (err) {
      this.logger.warn(`Geolocation setup failed: ${err.message}`);
    }
  }

  async navigate(
    url: string,
    sessionId = 'default',
  ): Promise<{ title: string; url: string }> {
    this.validateUrl(url);
    const page = await this.getOrCreatePage(sessionId);
    try {
      await page.goto(this.injectLocationParam(url), {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch (err) {
      throw new Error(`Navigation failed: ${err.message}`);
    }
    return { title: await page.title(), url: page.url() };
  }

  async click(selector: string, sessionId = 'default'): Promise<void> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      await page
        .locator(this.normalizeSelector(selector))
        .first()
        .click({ timeout: 10000 });
    } catch (err) {
      throw new Error(
        `Cannot click "${selector}": ${err.message}. ` +
          'Try browser_screenshot to see the current page state.',
      );
    }
  }

  async type(
    selector: string,
    text: string,
    sessionId = 'default',
  ): Promise<void> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      const locator = page.locator(this.normalizeSelector(selector)).first();
      await locator.fill('');
      await locator.fill(text);
    } catch (err) {
      throw new Error(
        `Cannot type into "${selector}": ${err.message}. ` +
          'Try browser_screenshot to see the current page state.',
      );
    }
  }

  async typeSlowly(
    selector: string,
    text: string,
    delayMs = 50,
    sessionId = 'default',
  ): Promise<void> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      const locator = page.locator(this.normalizeSelector(selector)).first();
      await locator.click();
      await locator.type(text, { delay: delayMs });
    } catch (err) {
      throw new Error(
        `Cannot type into "${selector}": ${err.message}. ` +
          'Try browser_screenshot to see the current page state.',
      );
    }
  }

  /**
   * Normalizes LLM-friendly selectors to Playwright syntax:
   * "text=Submit" -> text="Submit" (exact text) ; "button:text(OK)" -> button:has-text("OK")
   * Appends "visible=true" so the first visible match wins (e.g. modal options over footer text).
   */
  private normalizeSelector(raw: string): string {
    let sel = raw.trim();
    if (/^text=/i.test(sel)) {
      sel = sel.replace(/^text="?(.+?)"?$/i, 'text="$1"');
    } else if (/^([a-z0-9-]+):text\((.+)\)$/i.test(sel)) {
      sel = sel.replace(/^([a-z0-9-]+):text\((.+)\)$/i, '$1:has-text("$2")');
    }
    if (sel.includes('text=') || sel.includes(':has-text(')) {
      sel = `${sel} >> visible=true`;
    }
    return sel;
  }

  async pressKey(key: string, sessionId = 'default'): Promise<void> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      await page.keyboard.press(key);
    } catch (err) {
      throw new Error(`Cannot press key "${key}": ${err.message}`);
    }
  }

  async screenshot(sessionId = 'default'): Promise<string> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      const buffer = await page.screenshot({ type: 'png' });
      return buffer.toString('base64');
    } catch (err) {
      throw new Error(`Screenshot failed: ${err.message}`);
    }
  }

  async getContent(sessionId = 'default'): Promise<string> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      return page.evaluate(() => document.body.innerText);
    } catch (err) {
      throw new Error(`Cannot read page content: ${err.message}`);
    }
  }

  async getHtml(sessionId = 'default'): Promise<string> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      return page.content();
    } catch (err) {
      throw new Error(`Cannot read page HTML: ${err.message}`);
    }
  }

  async goBack(sessionId = 'default'): Promise<void> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      await page.goBack({ waitUntil: 'networkidle', timeout: 15000 });
    } catch (err) {
      throw new Error(`Cannot go back: ${err.message}`);
    }
  }

  async goForward(sessionId = 'default'): Promise<void> {
    const page = await this.getOrCreatePage(sessionId);
    try {
      await page.goForward({ waitUntil: 'networkidle', timeout: 15000 });
    } catch (err) {
      throw new Error(`Cannot go forward: ${err.message}`);
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      try {
        if (!existing.page.isClosed()) {
          await existing.page.close();
        }
      } catch {
        // page already closed
      }
      try {
        await existing.context.close();
      } catch {
        // context already disposed
      }
      this.sessions.delete(sessionId);
      this.logger.log(`Session closed: ${sessionId}`);
    }
  }

  async closeAllSessions(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
  }

  async close(): Promise<void> {
    await this.closeAllSessions();
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // browser already closed
      }
      this.browser = null;
      this.launchAttempted = false;
      this.logger.log('Browser closed');
    }
  }

  onModuleDestroy() {
    this.close().catch((err) => {
      this.logger.error(`Error during browser cleanup: ${err.message}`);
    });
  }
}
