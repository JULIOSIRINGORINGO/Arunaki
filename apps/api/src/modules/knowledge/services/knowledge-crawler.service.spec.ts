import { describe, it, expect } from 'vitest';
import { KnowledgeCrawlerService } from './knowledge-crawler.service.js';
import { CryptoHarvesterService } from './crypto-harvester.service.js';
import { KnowledgeLiveFetchTool } from '../../tools/services/knowledge-live-fetch.tool.js';

describe('KnowledgeCrawlerService & KnowledgeLiveFetchTool E2E', () => {
  const cryptoHarvester = new CryptoHarvesterService();
  const crawlerService = new KnowledgeCrawlerService(cryptoHarvester);
  const tool = new KnowledgeLiveFetchTool(crawlerService, {} as any);

  it('Test 1: Auto-resolves repositioned GitHub subfolder (Matt Pocock grill-me)', async () => {
    const result = await crawlerService.fetchLiveKnowledge({
      url: 'https://github.com/mattpocock/skills/tree/main/grill-me',
      format: 'markdown',
    });

    expect(result).toBeDefined();
    expect(result.extractedContent).toBeTruthy();
    expect(result.extractedContent.length).toBeGreaterThan(40);
    expect(result.extractedContent.toLowerCase()).toContain('grill-me');
    expect(result.url).toContain('raw.githubusercontent.com');
  }, 25000);

  it('Test 2: Auto-resolves GitHub root repository README.md', async () => {
    const result = await crawlerService.fetchLiveKnowledge({
      url: 'https://github.com/mattpocock/skills',
      format: 'markdown',
    });

    expect(result).toBeDefined();
    expect(result.extractedContent).toBeTruthy();
    expect(result.extractedContent.length).toBeGreaterThan(50);
  }, 25000);

  it('Test 3: Direct HTTP fetch on normal public webpage', async () => {
    const result = await crawlerService.fetchLiveKnowledge({
      url: 'https://example.com',
      format: 'markdown',
    });

    expect(result).toBeDefined();
    expect(result.extractedContent).toContain('Example Domain');
  }, 20000);

  it('Test 4: KnowledgeLiveFetchTool E2E execution with smart fallback', async () => {
    const toolResult = await tool.execute({
      url: 'https://github.com/mattpocock/skills/tree/main/grill-me',
      format: 'markdown',
    });

    expect(toolResult.status).toBe('success');
    expect(toolResult.data).toBeDefined();
    expect(toolResult.data.extractedContent).toBeTruthy();
    expect(toolResult.preview).toContain('grill-me');
  }, 25000);
});
