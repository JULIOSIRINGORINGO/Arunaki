import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionSearchService } from './session-search.service.js';

function makeResult(overrides: any = {}) {
  return {
    messageId: 'm1',
    chatHistoryId: 'ch1',
    workspaceId: 'ws1',
    role: 'assistant',
    content: 'harga jual produk',
    snippet: 'harga jual produk',
    rank: 1,
    ...overrides,
  };
}

describe('SessionSearchService - hybrid FTS5 + semantic fallback', () => {
  let service: SessionSearchService;
  let mockPrisma: any;
  let mockSemantic: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: vi.fn(),
    };
    mockSemantic = {
      semanticSearch: vi.fn().mockResolvedValue([]),
    };
    service = new SessionSearchService(mockPrisma as any, mockSemantic as any);
  });

  it('returns FTS5 results unchanged when enough hits', async () => {
    const results = [
      makeResult({ messageId: 'a', rank: 1 }),
      makeResult({ messageId: 'b', rank: 2 }),
      makeResult({ messageId: 'c', rank: 3 }),
    ];
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(results);

    const out = await service.search('harga jual', { limit: 10 });

    expect(out).toHaveLength(3);
    expect(mockSemantic.semanticSearch).not.toHaveBeenCalled();
  });

  it('supplements with semantic results when FTS5 is sparse', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([makeResult({ messageId: 'a', rank: 1 })]);
    mockSemantic.semanticSearch.mockResolvedValue([
      makeResult({ messageId: 'sem1', rank: 200, content: 'nilai penjualan bulan Maret' }),
    ]);

    const out = await service.search('nilai penjualan', { limit: 5 });

    expect(mockSemantic.semanticSearch).toHaveBeenCalledWith(
      'nilai penjualan',
      { workspaceId: undefined, role: undefined, limit: 5 },
    );
    expect(out).toHaveLength(2);
    expect(out[0].messageId).toBe('a');
    expect(out[1].messageId).toBe('sem1');
  });

  it('deduplicates messageIds already returned by FTS5', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([makeResult({ messageId: 'a', rank: 1 })]);
    mockSemantic.semanticSearch.mockResolvedValue([
      makeResult({ messageId: 'a', rank: 200 }),
      makeResult({ messageId: 'new', rank: 300 }),
    ]);

    const out = await service.search('query', { limit: 10 });

    expect(out).toHaveLength(2);
    expect(out.map((r) => r.messageId)).toEqual(['a', 'new']);
  });

  it('respects limit after merging semantic results', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([makeResult({ messageId: 'a', rank: 1 })]);
    mockSemantic.semanticSearch.mockResolvedValue([
      makeResult({ messageId: 's1', rank: 100 }),
      makeResult({ messageId: 's2', rank: 200 }),
      makeResult({ messageId: 's3', rank: 300 }),
    ]);

    const out = await service.search('query', { limit: 2 });

    expect(out).toHaveLength(2);
  });

  it('falls back to LIKE search when FTS5 throws', async () => {
    mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(new Error('fts error'));
    mockPrisma.message = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'm1',
          chatHistoryId: 'ch1',
          role: 'assistant',
          content: 'harga jual produk',
          chatHistory: { workspaceId: 'ws1' },
        },
      ]),
    };

    const out = await service.search('harga jual', { limit: 10 });

    expect(out).toHaveLength(1);
    expect(out[0].messageId).toBe('m1');
  });
});
