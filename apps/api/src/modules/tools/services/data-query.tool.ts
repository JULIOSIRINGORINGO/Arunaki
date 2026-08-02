import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class DataQueryTool {
  private readonly logger = new Logger(DataQueryTool.name);
  private readonly prisma = new PrismaClient();

  async queryData(sql: string): Promise<ToolResult> {
    const startTime = Date.now();

    if (!sql || sql.trim().length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Query SQL tidak boleh kosong',
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_QUERY', message: 'SQL query required' },
      };
    }

    const normalizedSql = sql.trim().toUpperCase();

    // Strip SQL comments and find the main statement verb.
    // ponytail: naive startsWith() guard was bypassable via `WITH ... DELETE` (SQLite
    // allows mutation verbs after a CTE block). The main verb is the LAST keyword
    // match — CTE bodies may contain earlier SELECTs (e.g. `WITH x AS (SELECT 1) DELETE ...`).
    const strippedSql = normalizedSql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    const verbMatches = strippedSql.match(
      /\b(SELECT|INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|ATTACH|DETACH|VACUUM|PRAGMA|REINDEX)\b/g,
    );

    const forbiddenVerbs = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'REPLACE',
      'DROP',
      'ALTER',
      'CREATE',
      'ATTACH',
      'DETACH',
      'VACUUM',
      'PRAGMA',
      'REINDEX',
    ];

    const hasForbiddenVerb = verbMatches && verbMatches.some(verb => forbiddenVerbs.includes(verb));

    if (
      !verbMatches ||
      hasForbiddenVerb ||
      normalizedSql.includes(';') ||
      normalizedSql.includes('--') ||
      normalizedSql.includes('/*')
    ) {
      return {
        status: 'error',
        data: {},
        preview: 'Hanya SELECT query yang diperbolehkan',
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'FORBIDDEN_QUERY',
          message: 'Only SELECT queries allowed',
        },
      };
    }

    try {
      this.logger.log(`Executing query: ${sql.substring(0, 100)}`);

      const result = await this.prisma.$queryRawUnsafe(sql);

      const preview = Array.isArray(result)
        ? `${result.length} rows returned`
        : 'Query executed';

      return {
        status: 'success',
        data: {
          rows: result,
          rowCount: Array.isArray(result) ? result.length : 0,
        },
        preview,
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      this.logger.error(`Query failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Query gagal: ${e.message}`,
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'QUERY_FAILED', message: e.message },
      };
    }
  }

  async listTables(): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const result = await this.prisma.$queryRawUnsafe(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );

      const tables = Array.isArray(result)
        ? result.map((r: any) => r.name)
        : [];

      return {
        status: 'success',
        data: { tables },
        preview: `Tables: ${tables.join(', ')}`,
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal list tables: ${e.message}`,
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'LIST_FAILED', message: e.message },
      };
    }
  }

  async describeTable(tableName: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
        return {
          status: 'error',
          data: {},
          preview: `Nama tabel tidak valid: ${tableName}`,
          metadata: {
            toolName: 'data_query',
            displayName: 'Query Database',
            executionTime: Date.now() - startTime,
          },
          error: { code: 'INVALID_TABLE_NAME', message: 'Invalid table name' },
        };
      }

      const result = await this.prisma.$queryRawUnsafe(
        `PRAGMA table_info(${tableName})`,
      );

      return {
        status: 'success',
        data: { columns: result },
        preview: `Table ${tableName}: ${Array.isArray(result) ? result.length : 0} columns`,
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal describe table: ${e.message}`,
        metadata: {
          toolName: 'data_query',
          displayName: 'Query Database',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'DESCRIBE_FAILED', message: e.message },
      };
    }
  }
}
