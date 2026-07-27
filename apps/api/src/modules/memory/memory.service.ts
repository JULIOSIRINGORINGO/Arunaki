import { Injectable } from '@nestjs/common';
import { Memory } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { MemoryRepository } from './memory.repository.js';

@Injectable()
export class MemoryService extends BaseService<Memory> {
  constructor(protected readonly repository: MemoryRepository) {
    super(repository);
  }

  async findActive(): Promise<Memory[]> {
    return this.repository.findActive();
  }

  async findByType(type: string): Promise<Memory[]> {
    return this.repository.findByType(type);
  }

  async findByKey(type: string, key: string): Promise<Memory | null> {
    return this.repository.findByKey(type, key);
  }

  async findForWorkspace(workspaceId: string): Promise<Memory[]> {
    return this.repository.findForWorkspace(workspaceId);
  }

  async incrementAccess(id: string): Promise<void> {
    return this.repository.incrementAccess(id);
  }

  async search(query: string): Promise<Memory[]> {
    return this.repository.search(query);
  }

  async cleanup(): Promise<number> {
    return this.repository.cleanup();
  }

  /**
   * Save or update a memory entry
   */
  async remember(data: {
    type: string;
    key: string;
    content: string;
    source?: string;
    importance?: number;
    workspaceId?: string;
    sessionId?: string;
  }): Promise<Memory> {
    return this.repository.upsert(data);
  }

  /**
   * Get memory context for system prompt injection
   * Returns top memories formatted for injection
   */
  async getMemoryContext(workspaceId?: string, maxTokens = 500): Promise<string> {
    const memories = workspaceId
      ? await this.findForWorkspace(workspaceId)
      : await this.findActive();

    if (memories.length === 0) return '';

    // Sort by importance, then by access count
    const sorted = memories
      .sort((a, b) => b.importance - a.importance || b.accessCount - a.accessCount)
      .slice(0, 20); // Limit to top 20

    const lines = sorted.map((m) => {
      const prefix = m.workspaceId ? `[Workspace]` : `[Global]`;
      return `${prefix} ${m.key}: ${m.content}`;
    });

    return lines.join('\n');
  }

  /**
   * Record user preference
   */
  async recordPreference(key: string, value: string, workspaceId?: string): Promise<Memory> {
    return this.remember({
      type: 'preference',
      key,
      content: value,
      source: 'auto',
      importance: 7,
      workspaceId,
    });
  }

  /**
   * Record workspace interaction
   */
  async recordInteraction(
    workspaceId: string,
    task: string,
    result: string,
  ): Promise<Memory> {
    const key = `interaction_${workspaceId}_${Date.now()}`;
    return this.remember({
      type: 'interaction',
      key,
      content: `Task: ${task}\nResult: ${result}`,
      source: 'auto',
      importance: 5,
      workspaceId,
    });
  }

  /**
   * Record workspace history
   */
  async recordWorkspaceHistory(
    workspaceId: string,
    summary: string,
  ): Promise<Memory> {
    const key = `history_${workspaceId}`;
    return this.remember({
      type: 'workspace_history',
      key,
      content: summary,
      source: 'auto',
      importance: 6,
      workspaceId,
    });
  }

  /**
   * Get user preferences
   */
  async getPreferences(workspaceId?: string): Promise<Memory[]> {
    const memories = workspaceId
      ? await this.findForWorkspace(workspaceId)
      : await this.findActive();
    return memories.filter((m) => m.type === 'preference');
  }
}