import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticSearchService } from './semantic-search.service.js';

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
}));

import { pipeline } from '@xenova/transformers';

function makeEmbeddingRow(overrides: any = {}) {
  return {
    messageId: 'm1',
    chatHistoryId: 'ch1',
    workspaceId: 'ws1',
    role: 'assistant',
    content: 'harga jual produk di bulan Maret',
    ...overrides,
  };
}

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: vi.fn(),
    };
    service = new SemanticSearchService(mockPrisma);
  });

  it('creates message_embeddings table on init', async () => {
    await service.onModuleInit();
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS message_embeddings'),
    );
  });

  it('embeds a single string via the pipeline', async () => {
    const data = new Float32Array(384);
    data.fill(0.1);
    const fakeExtractor = vi.fn().mockResolvedValue({ data });
    (pipeline as any).mockResolvedValue(fakeExtractor);

    const vec = await service.embed('harga jual');
    expect(vec.length).toBe(384);
    expect(vec[0]).toBeCloseTo(0.1, 6);
    expect(vec[1]).toBeCloseTo(0.1, 6);
  });

  it('returns [] (not throw) when nothing is embedded yet', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // missing backfill list
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // embedding rows

    const results = await service.semanticSearch('harga jual');
    expect(results).toEqual([]);
  });

  it('ranks cached embeddings by cosine similarity', async () => {
    const dim = 384;

    const vec = (freq: number) => {
      const v = new Float32Array(dim);
      for (let i = 0; i < dim; i++) v[i] = Math.sin(i * freq);
      return Buffer.from(v.buffer);
    };

    // Close to query term frequency vs far
    const rows = [
      makeEmbeddingRow({
        messageId: 'near',
        content: 'nilai penjualan bulan Maret',
        embedding: vec(0.5),
      }),
      makeEmbeddingRow({
        messageId: 'far',
        content: 'jadwal meeting tim marketing',
        embedding: vec(7.3),
      }),
    ];
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([]) // ensureBackfilled: no missing messages
      .mockResolvedValueOnce(rows);

    const extractor = vi.fn().mockResolvedValue({
      data: (() => {
        const v = new Float32Array(dim);
        for (let i = 0; i < dim; i++) v[i] = Math.sin(i * 0.5);
        return v;
      })(),
    });
    (pipeline as any).mockResolvedValue(extractor);

    const results = await service.semanticSearch('nilai penjualan');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].messageId).toBe('near');
  });

  it('filters out low-similarity matches (score <= 0.35)', async () => {
    const dim = 384;
    const rows = [
      makeEmbeddingRow({
        messageId: 'unrelated',
        embedding: Buffer.from(new Float32Array(dim).buffer),
      }),
    ];
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(rows);

    const queryVec = new Float32Array(dim);
    queryVec.fill(0.5);
    (pipeline as any).mockResolvedValue(
      vi.fn().mockResolvedValue({ data: queryVec }),
    );

    const results = await service.semanticSearch('completely different query');
    expect(results).toEqual([]);
  });

  it('swallows pipeline load errors and returns []', async () => {
    (pipeline as any).mockRejectedValue(new Error('model download failed'));
    const results = await service.semanticSearch('apapun');
    expect(results).toEqual([]);
  });
});
