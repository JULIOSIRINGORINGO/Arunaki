import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { MemoryService } from '../../memory/memory.service.js';
import { SessionSearchService } from '../../memory/session-search.service.js';
import { Memory } from '@prisma/client';

@Injectable()
export class MemoryTool {
  private readonly logger = new Logger(MemoryTool.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly sessionSearchService: SessionSearchService,
  ) {}

  async remember(data: {
    type: string;
    key: string;
    content: string;
    confidence?: number;
    category?: string;
    tags?: string[];
    workspaceId: string;
  }): Promise<ToolResult> {
    try {
      const memory = await this.memoryService.remember({
        type: data.type,
        key: data.key,
        content: data.content,
        workspaceId: data.workspaceId,
      });

      const preview = `Saved memory: [${memory.type}] ${memory.key} = ${memory.content.substring(0, 80)}${memory.content.length > 80 ? '...' : ''}`;

      return {
        status: 'success',
        data: {
          id: memory.id,
          type: memory.type,
          key: memory.key,
          importance: memory.importance,
        },
        preview,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to save memory: ${e.message}`,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  async recall(type: string, key: string): Promise<ToolResult> {
    try {
      const memory = await this.memoryService.findByKey(type, key);
      if (!memory) {
        return {
          status: 'error',
          data: {},
          preview: `Memory "[${type}] ${key}" not found.`,
          metadata: {
            toolName: 'memory',
            displayName: 'Memory',
            executionTime: 0,
          },
          error: { code: 'NOT_FOUND', message: `Memory not found` },
        };
      }

      await this.memoryService.incrementAccess(memory.id);

      const preview = `[${memory.type}] ${memory.key}: ${memory.content}`;

      return {
        status: 'success',
        data: {
          type: memory.type,
          key: memory.key,
          content: memory.content,
          domain: memory.domain,
          importance: memory.importance,
        },
        preview,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to recall memory: ${e.message}`,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  async listMemories(params?: {
    type?: string;
    category?: string;
    workspaceId?: string;
    includeGlobal?: boolean;
  }): Promise<ToolResult> {
    try {
      let memories: Memory[] = [];
      if (params?.type) {
        memories = await this.memoryService.findByType(params.type);
      } else if (params?.workspaceId) {
        memories = await this.memoryService.findForWorkspace(params.workspaceId);
      } else {
        memories = await this.memoryService.findActive();
      }

      const preview =
        memories.length > 0
          ? memories
              .map(
                (m: Memory) =>
                  `[${m.type}] ${m.key}: ${m.content.substring(0, 60)}${m.content.length > 60 ? '...' : ''}`,
              )
              .join('\n')
          : 'No memories saved.';

      return {
        status: 'success',
        data: { count: memories.length, memories },
        preview,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to list memories: ${e.message}`,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  async searchMemories(query: string, workspaceId: string): Promise<ToolResult> {
    try {
      const memories = await this.memoryService.search(query, workspaceId);

      if (memories.length === 0) {
        return {
          status: 'success',
          data: { count: 0, memories: [] },
          preview: `No memories found for "${query}".`,
          metadata: {
            toolName: 'memory',
            displayName: 'Memory',
            executionTime: 0,
          },
        };
      }

      const preview = memories
        .map(
          (m: Memory) =>
            `[${m.type}] ${m.key}: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`,
        )
        .join('\n');

      return {
        status: 'success',
        data: { count: memories.length, memories },
        preview,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to search memories: ${e.message}`,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  async deleteMemory(type: string, key: string, workspaceId: string): Promise<ToolResult> {
    try {
      const memory = await this.memoryService.findByKey(type, key);
      if (!memory) {
        return {
          status: 'error',
          data: {},
          preview: `Memory "[${type}] ${key}" not found.`,
          metadata: {
            toolName: 'memory',
            displayName: 'Memory',
            executionTime: 0,
          },
          error: { code: 'NOT_FOUND', message: `Memory not found` },
        };
      }

      if (memory.workspaceId !== null && memory.workspaceId !== workspaceId) {
        return {
          status: 'error',
          data: {},
          preview: `Deletion rejected: Memory does not belong to your workspace.`,
          metadata: {
            toolName: 'memory',
            displayName: 'Memory',
            executionTime: 0,
          },
          error: { code: 'FORBIDDEN', message: `Cannot delete memory from another workspace` },
        };
      }

      await this.memoryService.delete(memory.id);

      return {
        status: 'success',
        data: { type, key },
        preview: `Memory "[${type}] ${key}" deleted successfully.`,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to delete memory: ${e.message}`,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
        error: { code: 'MEMORY_ERROR', message: e.message },
      };
    }
  }

  /**
   * Search across all sessions for relevant messages (FTS5).
   * Enables cross-session recall.
   */
  async searchSessions(
    query: string,
    workspaceId?: string,
  ): Promise<ToolResult> {
    try {
      const results = await this.sessionSearchService.search(query, {
        workspaceId,
        limit: 5,
      });

      if (results.length === 0) {
        return {
          status: 'success',
          data: { count: 0, results: [] },
          preview: `No relevant conversations found for "${query}".`,
          metadata: {
            toolName: 'memory',
            displayName: 'Memory',
            executionTime: 0,
          },
        };
      }

      const preview = results
        .map(
          (r: any) =>
            `[${r.role}] (${r.sessionTitle || 'Session'}): ${r.content.substring(0, 100)}${r.content.length > 100 ? '...' : ''}`,
        )
        .join('\n');

      return {
        status: 'success',
        data: { count: results.length, results },
        preview,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to search sessions: ${e.message}`,
        metadata: {
          toolName: 'memory',
          displayName: 'Memory',
          executionTime: 0,
        },
        error: { code: 'SESSION_SEARCH_ERROR', message: e.message },
      };
    }
  }
}
