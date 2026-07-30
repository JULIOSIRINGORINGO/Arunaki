import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

@Injectable()
export class BrowserInteractionService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserInteractionService.name);
  private browser: Browser | null = null;
  private page: Page | null = null;

  async launch(): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({
      headless: false,
      args: ['--start-maximized'],
    });
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'id-ID',
    });
    this.page = await context.newPage();
    this.logger.log('Browser launched (headed, visible)');
  }

  get isConnected(): boolean {
    return this.browser !== null && this.page !== null;
  }

  async navigate(url: string): Promise<{ title: string; url: string }> {
    await this.ensurePage();
    await this.page!.goto(url, { waitUntil: 'networkidle' });
    return { title: await this.page!.title(), url: this.page!.url() };
  }

  async click(selector: string): Promise<void> {
    await this.ensurePage();
    await this.page!.click(selector);
  }

  async type(selector: string, text: string): Promise<void> {
    await this.ensurePage();
    await this.page!.fill(selector, '');
    await this.page!.fill(selector, text);
  }

  async typeSlowly(selector: string, text: string, delayMs = 50): Promise<void> {
    await this.ensurePage();
    await this.page!.click(selector);
    await this.page!.type(selector, text, { delay: delayMs });
  }

  async pressKey(key: string): Promise<void> {
    await this.ensurePage();
    await this.page!.keyboard.press(key);
  }

  async screenshot(): Promise<string> {
    await this.ensurePage();
    const buffer = await this.page!.screenshot({ type: 'png' });
    return buffer.toString('base64');
  }

  async getContent(): Promise<string> {
    await this.ensurePage();
    return this.page!.evaluate(() => document.body.innerText);
  }

  async getHtml(): Promise<string> {
    await this.ensurePage();
    return this.page!.content();
  }

  async goBack(): Promise<void> {
    await this.ensurePage();
    await this.page!.goBack({ waitUntil: 'networkidle' });
  }

  async goForward(): Promise<void> {
    await this.ensurePage();
    await this.page!.goForward({ waitUntil: 'networkidle' });
  }

  async waitForSelector(selector: string, timeoutMs = 5000): Promise<void> {
    await this.ensurePage();
    await this.page!.waitForSelector(selector, { timeout: timeoutMs });
  }

  async evaluate(fn: string): Promise<any> {
    await this.ensurePage();
    return this.page!.evaluate(fn);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.logger.log('Browser closed');
    }
  }

  onModuleDestroy() {
    this.close();
  }

  private async ensurePage(): Promise<void> {
    if (!this.isConnected) {
      await this.launch();
    }
  }
}