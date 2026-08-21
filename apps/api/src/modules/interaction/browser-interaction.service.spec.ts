import { describe, it, expect, afterAll } from 'vitest';
import { BrowserInteractionService } from './browser-interaction.service.js';
import { BrowserInteractionTool } from '../tools/services/browser-interaction.tool.js';

describe('BrowserInteractionService & BrowserInteractionTool E2E', () => {
  const browserService = new BrowserInteractionService();
  const tool = new BrowserInteractionTool(browserService);

  afterAll(async () => {
    await browserService.onModuleDestroy();
  });

  it('Step 1: Navigate to Cititex website and read live rendered content', async () => {
    const navResult = await tool.execute({
      action: 'navigate',
      url: 'https://cititex.com/id',
    });

    expect(navResult.status).toBe('success');
    expect(navResult.data).toBeDefined();

    const contentResult = await tool.execute({
      action: 'getContent',
    });

    expect(contentResult.status).toBe('success');
    expect(contentResult.data.content).toBeTruthy();
    expect(contentResult.data.content.length).toBeGreaterThan(100);
    expect(contentResult.data.content.toLowerCase()).toContain('cititex');
  }, 45000);

  it('Step 2: Navigate to NSA Premium product page and extract live product details', async () => {
    const navResult = await tool.execute({
      action: 'navigate',
      url: 'https://cititex.com/id/product/new-states-apparel-premium-cotton-t-shirt-7200',
    });

    expect(navResult.status).toBe('success');

    const contentResult = await tool.execute({
      action: 'getContent',
    });

    expect(contentResult.status).toBe('success');
    expect(contentResult.data.content).toBeTruthy();
    expect(contentResult.data.content.toLowerCase()).toContain('new states apparel');
  }, 45000);
});
