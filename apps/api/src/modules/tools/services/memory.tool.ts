import { Injectable, Logger } from '@nestjs/common';
import { Memory } from '@prisma/client';
import { MemoryService } from '../../memory/memory.service.js';
import { SessionSearchService } from '../../memory/session-search.service.js';
import {
  ToolResult,
} from '../interfaces/tool-result.interface.js';

@Injectable()
export class MemoryTool {
  private readonly logger = new Logger(MemoryTool.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly sessionSearchService: SessionSearchService,
  ) {}

  async listMemories(workspaceId?: string): Promise<ToolResult> {
    try {
      const memories = workspaceId
        ? await this.memoryService.findForWorkspace(workspaceId)
        : await this.memoryService.findActive();

      if (memories.length === 0) {
        return {
          status: 'success',
          data: { count: 0, memories: [] },
          preview: 'Belum ada memory tersimpan.',
          metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        };
      }

      const memoryList = memories.map((m: Memory) => ({
        type: m.type,
        key: m.key,
        content: m.content.substring(0, 100),
        importance: m.importance,
        accessCount: m.accessCount,
        source: m.source,
        scope: m.workspaceId ? 'workspace' : 'global',
      }));

      const preview = memories
        .slice(0, 10)
        .map((m: Memory) => `[${m.type}] ${m.key}: ${m.content.substring(0, 80)}`)
        .join('\n');

      return {
        status: 'success',
        data: { count: memories.length, memories: memoryList },
        preview,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal list memories: ${e.message}`,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  async saveMemory(data: {
    type: string;
    key: string;
    content: string;
    importance?: number;
    domain?: string;
    workspaceId?: string;
  }): Promise<ToolResult> {
    try {
      const memory = await this.memoryService.remember({
        ...data,
        source: 'auto',
      });

      // Check if it was rejected as duplicate
      const preview = `Memory tersimpan: [${memory.type}] ${memory.key} (domain: ${memory.domain || 'generic'})`;

      return {
        status: 'success',
        data: {
          id: memory.id,
          type: memory.type,
          key: memory.key,
          content: memory.content,
          domain: memory.domain,
        },
        preview,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal simpan memory: ${e.message}`,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  async searchMemories(query: string): Promise<ToolResult> {
    try {
      const memories = await this.memoryService.search(query);

      if (memories.length === 0) {
        return {
          status: 'success',
          data: { count: 0, memories: [] },
          preview: `Tidak ditemukan memory untuk "${query}".`,
          metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        };
      }

      const preview = memories
        .map((m: Memory) => `[${m.type}] ${m.key}: ${m.content.substring(0, 80)}`)
        .join('\n');

      return {
        status: 'success',
        data: { count: memories.length, memories },
        preview,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal search memories: ${e.message}`,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  async deleteMemory(type: string, key: string): Promise<ToolResult> {
    try {
      const memory = await this.memoryService.findByKey(type, key);
      if (!memory) {
        return {
          status: 'error',
          data: {},
          preview: `Memory "[${type}] ${key}" tidak ditemukan.`,
          metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
          error: { code: 'NOT_FOUND', message: `Memory not found` },
        };
      }

      await this.memoryService.delete(memory.id);

      return {
        status: 'success',
        data: { type, key },
        preview: `Memory "[${type}] ${key}" berhasil dihapus.`,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal hapus memory: ${e.message}`,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  /**
   * Search across all sessions for relevant messages (FTS5).
   * Enables cross-session recall.
   */
  async searchSessions(query: string, workspaceId?: string): Promise<ToolResult> {
    try {
      const results = await this.sessionSearchService.search(query, {
        workspaceId,
        limit: 5,
      });

      if (results.length === 0) {
        return {
          status: 'success',
          data: { count: 0, results: [] },
          preview: `Tidak ditemukan percakapan relevan untuk "${query}".`,
          metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        };
      }

      const preview = results
        .map((r) => `[${r.role}] ${r.snippet.substring(0, 100)}`)
        .join('\n');

      return {
        status: 'success',
        data: { count: results.length, results },
        preview,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal search sessions: ${e.message}`,
        metadata: { toolName: 'memory', displayName: 'Memory', executionTime: 0 },
        error: { code: 'SEARCH_ERROR', message: e.message },
      };
    }
  }
}