import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { randomUUID } from 'node:crypto';

export const SessionEventType = {
  SESSION_CREATED: 'session_created',
  HUMAN_DIRECT_MESSAGE: 'human_direct_message',
  AGENT_STARTED: 'agent_started',
  AGENT_RESPONSE: 'agent_response',
  AGENT_COMPLETED: 'agent_completed',
  SESSION_TERMINATED: 'session_terminated',
} as const;

export type SessionEventTypeValue = (typeof SessionEventType)[keyof typeof SessionEventType];

export interface SessionEventRecord {
  id: string;
  type: string;
  sessionKey: string;
  agentId: string;
  payload: Record<string, any>;
  sequence: number;
  createdAt: Date;
}

const TABLE = 'session_events';

@Injectable()
export class SessionStateEventsService implements OnModuleInit {
  private readonly logger = new Logger(SessionStateEventsService.name);
  private cleanupCounter = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTable();
  }

  private async ensureTable(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${TABLE}" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "type" TEXT NOT NULL,
          "sessionKey" TEXT NOT NULL,
          "agentId" TEXT NOT NULL,
          "payload" TEXT NOT NULL DEFAULT '{}',
          "sequence" INTEGER NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_session_events_session_sequence"
        ON "${TABLE}"("sessionKey", "sequence")
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_session_events_session_created"
        ON "${TABLE}"("sessionKey", "createdAt")
      `);
      this.logger.log('Session events table ensured');
    } catch (err: any) {
      this.logger.warn(`Session events table init skipped: ${err.message}`);
    }
  }

  async record(
    type: SessionEventTypeValue | string,
    sessionKey: string,
    agentId: string,
    payload?: Record<string, any>,
  ): Promise<void> {
    try {
      const id = randomUUID();
      const now = new Date().toISOString();
      // ponytail: atomic MAX+1 inside INSERT so concurrent record() calls can't
      // produce duplicate sequences for the same sessionKey
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${TABLE}" ("id", "type", "sessionKey", "agentId", "payload", "sequence", "createdAt") VALUES (?, ?, ?, ?, ?, COALESCE((SELECT MAX("sequence") + 1 FROM "${TABLE}" WHERE "sessionKey" = ?), 1), ?)`,
        id,
        type,
        sessionKey,
        agentId,
        JSON.stringify(payload || {}),
        sessionKey,
        now,
      );

      this.cleanupCounter++;
      if (this.cleanupCounter >= 100) {
        this.cleanupCounter = 0;
        this.cleanup().catch((err) =>
          this.logger.debug(`Cleanup skipped: ${err.message}`),
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to record session event: ${err.message}`);
    }
  }

  async getVersion(sessionKey: string, agentId: string): Promise<number> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ maxSeq: number }[]>(
        `SELECT COALESCE(MAX("sequence"), 0) as "maxSeq" FROM "${TABLE}" WHERE "sessionKey" = ? AND "agentId" = ?`,
        sessionKey,
        agentId,
      );
      return Number(rows[0]?.maxSeq ?? 0);
    } catch {
      return 0;
    }
  }

  async listSince(
    sessionKey: string,
    agentId: string,
    afterSequence: number,
    limit = 50,
  ): Promise<SessionEventRecord[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${TABLE}" WHERE "sessionKey" = ? AND "agentId" = ? AND "sequence" > ? ORDER BY "sequence" ASC LIMIT ?`,
        sessionKey,
        agentId,
        afterSequence,
        limit,
      );
      return rows.map(this.mapRow);
    } catch {
      return [];
    }
  }

  async listBySession(
    sessionKey: string,
    limit = 100,
    offset = 0,
  ): Promise<SessionEventRecord[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${TABLE}" WHERE "sessionKey" = ? ORDER BY "sequence" DESC LIMIT ? OFFSET ?`,
        sessionKey,
        limit,
        offset,
      );
      return rows.map(this.mapRow);
    } catch {
      return [];
    }
  }

  async cleanup(): Promise<{ deleted: number }> {
    try {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const result = await this.prisma.$executeRawUnsafe(
        `DELETE FROM "${TABLE}" WHERE "createdAt" < ?`,
        thirtyDaysAgo,
      );

      const overLimit = await this.prisma.$queryRawUnsafe<
        { sessionKey: string; cnt: number }[]
      >(
        `SELECT "sessionKey", COUNT(*) as cnt FROM "${TABLE}" GROUP BY "sessionKey" HAVING cnt > 50000`,
      );
      for (const row of overLimit) {
        const ids = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "${TABLE}" WHERE "sessionKey" = ? ORDER BY "sequence" ASC LIMIT ?`,
          row.sessionKey,
          row.cnt - 40000,
        );
        if (ids.length > 0) {
          const idList = ids.map((r) => `'${r.id}'`).join(',');
          await this.prisma.$executeRawUnsafe(
            `DELETE FROM "${TABLE}" WHERE "id" IN (${idList})`,
          );
        }
      }

      this.logger.debug(`Session events cleanup completed`);
      return { deleted: result };
    } catch (err: any) {
      this.logger.debug(`Cleanup error: ${err.message}`);
      return { deleted: 0 };
    }
  }

  private mapRow(row: any): SessionEventRecord {
    let payload: Record<string, any> = {};
    try {
      payload = JSON.parse(row.payload || '{}');
    } catch {
      payload = {};
    }
    return {
      id: row.id,
      type: row.type,
      sessionKey: row.sessionKey,
      agentId: row.agentId,
      payload,
      sequence: row.sequence,
      createdAt: new Date(row.createdAt),
    };
  }
}
