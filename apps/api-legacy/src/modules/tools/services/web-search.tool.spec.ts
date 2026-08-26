import { describe, it, expect } from 'vitest';
import { WebSearchTool } from './web-search.tool.js';

describe('WebSearchTool Zero-Config Engine', () => {
  const tool = new WebSearchTool();

  it('should search NSA Premium t-shirt colors and return rich results without API key', async () => {
    const result = await tool.searchWeb('NSA Premium 7200 kaos pilihan warna');

    expect(result.status).toBe('success');
    expect(result.data).toBeDefined();
    expect(result.preview).toBeTruthy();
    expect(result.preview.length).toBeGreaterThan(50);
    // Should have results containing relevant terms
    expect(result.data.total).toBeGreaterThan(0);
  }, 20000);
});
