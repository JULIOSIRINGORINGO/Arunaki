import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/providers/prisma.service.js';

/**
 * SemanticSearchService — hybrid recall layer (Gap #10).
 *
 * FTS5 keyword search (SessionSearchService) stays the first layer.
 * This service is the SECOND layer: when FTS5 returns sparse/no results,
 * fall back to embedding-based semantic similarity using a small
 * on-device MiniLM model (Xenova/all-MiniLM-L6-v2 via transformers.js).
 *
 * Embeddings are cached in a local SQLite table (`message_embeddings`),
 * so the model is only invoked once per message, not per query.
 */

export interface SemanticSearchOptions {
  workspaceId?: string;
  role?: string;
  limit?: number;
}

export interface SemanticSearchResult {
  messageId: string;
  chatHistoryId: string;
  workspaceId: string | null;
  role: string;
  content: string;
  snippet: string;
  rank: number;
}

interface EmbeddingRow {
  messageId: string;
  chatHistoryId: string;
  workspaceId: string | null;
  role: string;
  content: string;
  embedding: Buffer;
}

@Injectable()
export class SemanticSearchService implements OnModuleInit {
  private readonly logger = new Logger(SemanticSearchService.name);
  private pipelinePromise: Promise<any> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS message_embeddings (
          message_id     TEXT PRIMARY KEY,
          chat_history_id TEXT NOT NULL,
          workspace_id   TEXT,
          role           TEXT NOT NULL,
          content        TEXT NOT NULL,
          embedding      BLOB NOT NULL
        )
      `);
    } catch (err: any) {
      this.logger.warn(
        `message_embeddings table init failed (non-critical): ${err.message}`,
      );
    }
  }

  /** Lazily load the embedding pipeline once; model downloads on first use. */
  private getPipeline(): Promise<any> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = import('@xenova/transformers').then(
        ({ pipeline }) =>
          pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true,
          }),
      );
    }
    return this.pipelinePromise;
  }

  /** Embed one string → normalized 384-dim Float32Array. */
  async embed(text: string): Promise<Float32Array> {
    const extractor = await this.getPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return new Float32Array(output.data);
  }

  /**
   * Semantic search over cached message embeddings.
   * Returns [] (not throw) when the model can't load or nothing is cached,
   * so the FTS5 layer is never degraded by this fallback.
   */
  async semanticSearch(
    query: string,
    options?: SemanticSearchOptions,
  ): Promise<SemanticSearchResult[]> {
    const limit = options?.limit || 5;
    try {
      await this.ensureBackfilled(options?.workspaceId);

      const where: string[] = [];
      const params: any[] = [];
      if (options?.workspaceId) {
        where.push(`workspace_id = ?`);
        params.push(options.workspaceId);
      }
      if (options?.role) {
        where.push(`role = ?`);
        params.push(options.role);
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const rows = await this.prisma.$queryRawUnsafe<EmbeddingRow[]>(
        `SELECT
           message_id as messageId,
           chat_history_id as chatHistoryId,
           workspace_id as workspaceId,
           role,
           content,
           embedding
         FROM message_embeddings
         ${whereSql}`,
        ...params,
      );

      if (rows.length === 0) return [];

      const queryVec = await this.embed(query);
      const scored = rows
        .map((row) => ({
          row,
          score: cosineSimilarity(
            queryVec,
            bufferToFloat32(row.embedding, 384),
          ),
        }))
        .filter((s) => s.score > 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored.map((s, i) => ({
        messageId: s.row.messageId,
        chatHistoryId: s.row.chatHistoryId,
        workspaceId: s.row.workspaceId,
        role: s.row.role,
        content: s.row.content,
        snippet: s.row.content.substring(0, 200),
        rank: Math.round(s.score * 1000) + i,
      }));
    } catch (err: any) {
      this.logger.warn(`Semantic search failed (falling back to FTS5): ${err.message}`);
      return [];
    }
  }

  /**
   * Embed messages that don't have an embedding yet.
   * Runs at most BATCH_PER_CALL per invocation so the first semantic search
   * on a large DB doesn't block for minutes.
   */
  private async ensureBackfilled(workspaceId?: string): Promise<void> {
    const missing = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; chatHistoryId: string; workspaceId: string | null; role: string; content: string }>
    >(
      `SELECT m.id, m.chatHistoryId as chatHistoryId,
              ch.workspaceId as workspaceId, m.role, m.content
       FROM messages m
       JOIN chat_histories ch ON ch.id = m.chatHistoryId
       LEFT JOIN message_embeddings e ON e.message_id = m.id
       WHERE e.message_id IS NULL
         AND m.content != ''
         AND (m.role = 'assistant' OR m.role = 'user')
       ${workspaceId ? `AND ch.workspaceId = ?` : ''}
       LIMIT 200`,
      ...(workspaceId ? [workspaceId] : []),
    );

    if (missing.length === 0) return;

    this.logger.log(`Embedding ${missing.length} messages (semantic recall)...`);

    const extractor = await this.getPipeline();
    const batchSize = 20;
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      const output = await extractor(batch.map((m) => m.content), {
        pooling: 'mean',
        normalize: true,
      });
      const dim = 384;
      const data = new Float32Array(output.data);

      for (let j = 0; j < batch.length; j++) {
        const vec = new Float32Array(dim);
        vec.set(data.subarray(j * dim, (j + 1) * dim));
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO message_embeddings
             (message_id, chat_history_id, workspace_id, role, content, embedding)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(message_id) DO NOTHING`,
          batch[j].id,
          batch[j].chatHistoryId,
          batch[j].workspaceId,
          batch[j].role,
          batch[j].content,
          Buffer.from(vec.buffer),
        );
      }
    }
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Reinterpret a BLOB Buffer (Float32 bytes) as a Float32Array. */
function bufferToFloat32(buf: Buffer, dim: number): Float32Array {
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return new Float32Array(bytes.buffer, bytes.byteOffset, dim);
}
