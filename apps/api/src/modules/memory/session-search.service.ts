import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/providers/prisma.service.js';

/**
 * SessionSearchService — FTS5-powered cross-session recall.
 *
 * Creates a SQLite FTS5 virtual table for fast full-text search
 * across all chat messages. Enables agent to recall relevant
 * context from past conversations.
 *
 * Inspired OpenClaw's session_search with FTS5.
 */
@Injectable()
export class SessionSearchService implements OnModuleInit {
  private readonly logger = new Logger(SessionSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.initializeFTS5();
  }

  /**
   * Initialize FTS5 virtual table and triggers.
   * Called once on module init.
   */
  private async initializeFTS5() {
    try {
      // Create FTS5 virtual table for messages
      await this.prisma.$executeRawUnsafe(`
        CREATE VIRTUAL TABLE IF NOT EXISTS message_fts USING fts5(
          message_id,
          chat_history_id,
          workspace_id,
          role,
          content,
          content=messages,
          content_rowid=rowid
        )
      `);

      // Create triggers to keep FTS index in sync
      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
          INSERT INTO message_fts(rowid, message_id, chat_history_id, workspace_id, role, content)
          VALUES (new.rowid, new.id, new.chatHistoryId,
            (SELECT workspaceId FROM chat_histories WHERE id = new.chatHistoryId),
            new.role, new.content);
        END
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
          INSERT INTO message_fts(message_fts, rowid, message_id, chat_history_id, workspace_id, role, content)
          VALUES('delete', old.rowid, old.id, old.chatHistoryId,
            (SELECT workspaceId FROM chat_histories WHERE id = old.chatHistoryId),
            old.role, old.content);
        END
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
          INSERT INTO message_fts(message_fts, rowid, message_id, chat_history_id, workspace_id, role, content)
          VALUES('delete', old.rowid, old.id, old.chatHistoryId,
            (SELECT workspaceId FROM chat_histories WHERE id = old.chatHistoryId),
            old.role, old.content);
          INSERT INTO message_fts(rowid, message_id, chat_history_id, workspace_id, role, content)
          VALUES (new.rowid, new.id, new.chatHistoryId,
            (SELECT workspaceId FROM chat_histories WHERE id = new.chatHistoryId),
            new.role, new.content);
        END
      `);

      // Populate FTS index from existing messages (if empty)
      const countResult = await this.prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM message_fts`
      );
      const ftsCount = countResult[0]?.cnt || 0;

      if (ftsCount === 0) {
        const msgCount = await this.prisma.message.count();
        if (msgCount > 0) {
          this.logger.log(`Populating FTS5 index from ${msgCount} existing messages...`);
          await this.prisma.$executeRawUnsafe(`
            INSERT INTO message_fts(rowid, message_id, chat_history_id, workspace_id, role, content)
            SELECT m.rowid, m.id, m.chatHistoryId,
              ch.workspaceId, m.role, m.content
            FROM messages m
            JOIN chat_histories ch ON ch.id = m.chatHistoryId
          `);
          this.logger.log('FTS5 index populated successfully');
        }
      }

      this.logger.log('FTS5 session search initialized');
    } catch (err: any) {
      this.logger.warn(`FTS5 initialization failed (non-critical): ${err.message}`);
    }
  }

  /**
   * Search across all sessions for relevant messages.
   * Returns ranked results with context.
   */
  async search(
    query: string,
    options?: {
      workspaceId?: string;
      limit?: number;
      role?: string;
    }
  ): Promise<Array<{
    messageId: string;
    chatHistoryId: string;
    workspaceId: string | null;
    role: string;
    content: string;
    snippet: string;
    rank: number;
  }>> {
    const limit = options?.limit || 10;

    try {
      // Build query with optional workspace filter
      let sql = `
        SELECT
          message_id as messageId,
          chat_history_id as chatHistoryId,
          workspace_id as workspaceId,
          role,
          content,
          snippet(message_fts, 4, '>>>', '<<<', '...', 32) as snippet,
          rank
        FROM message_fts
        WHERE message_fts MATCH ?
      `;
      const params: any[] = [query];

      if (options?.workspaceId) {
        sql += ` AND workspace_id = ?`;
        params.push(options.workspaceId);
      }

      if (options?.role) {
        sql += ` AND role = ?`;
        params.push(options.role);
      }

      sql += ` ORDER BY rank LIMIT ?`;
      params.push(limit);

      const results = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

      return results.map((r) => ({
        messageId: r.messageId,
        chatHistoryId: r.chatHistoryId,
        workspaceId: r.workspaceId,
        role: r.role,
        content: r.content,
        snippet: r.snippet || r.content.substring(0, 200),
        rank: r.rank || 0,
      }));
    } catch (err: any) {
      this.logger.warn(`FTS5 search failed: ${err.message}`);
      // Fallback to LIKE search
      return this.fallbackSearch(query, options);
    }
  }

  /**
   * Fallback LIKE-based search when FTS5 fails.
   */
  private async fallbackSearch(
    query: string,
    options?: {
      workspaceId?: string;
      limit?: number;
      role?: string;
    }
  ): Promise<Array<{
    messageId: string;
    chatHistoryId: string;
    workspaceId: string | null;
    role: string;
    content: string;
    snippet: string;
    rank: number;
  }>> {
    const limit = options?.limit || 10;

    const where: any = {
      content: { contains: query },
    };

    if (options?.role) {
      where.role = options.role;
    }

    if (options?.workspaceId) {
      where.chatHistory = { workspaceId: options.workspaceId };
    }

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        chatHistoryId: true,
        role: true,
        content: true,
        chatHistory: { select: { workspaceId: true } },
      },
    });

    return messages.map((m) => ({
      messageId: m.id,
      chatHistoryId: m.chatHistoryId,
      workspaceId: m.chatHistory.workspaceId,
      role: m.role,
      content: m.content,
      snippet: m.content.substring(0, 200),
      rank: 0,
    }));
  }

  /**
   * Search for relevant context to inject into system prompt.
   * Returns formatted context string.
   */
  async getRelevantContext(
    query: string,
    workspaceId?: string,
    maxChars = 2000
  ): Promise<string> {
    const results = await this.search(query, {
      workspaceId,
      limit: 5,
      role: 'assistant',
    });

    if (results.length === 0) return '';

    const contextLines = results.map((r) => {
      const preview = r.snippet.replace(/>>>/g, '').replace(/<<<>/g, '').substring(0, 150);
      return `- [${r.role}] ${preview}`;
    });

    let context = `## Relevant Past Conversations\n${contextLines.join('\n')}`;

    // Enforce char limit
    if (context.length > maxChars) {
      context = context.substring(0, maxChars) + '\n[...truncated]';
    }

    return context;
  }
}
