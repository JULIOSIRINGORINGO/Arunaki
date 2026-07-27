import { Injectable, Logger } from '@nestjs/common';
import { Memory } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { MemoryRepository } from './memory.repository.js';

@Injectable()
export class MemoryService extends BaseService<Memory> {
  private readonly logger = new Logger(MemoryService.name);

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

  /**
   * Find memories relevant to a domain and/or workspace.
   * Used for frozen snapshot injection.
   */
  async findRelevant(
    domain?: string,
    workspaceId?: string,
    limit = 20,
  ): Promise<Memory[]> {
    return this.repository.findRelevant(domain, workspaceId, limit);
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
   * Save or update a memory entry.
   * Includes duplicate prevention — rejects if content already exists.
   */
  async remember(data: {
    type: string;
    key: string;
    content: string;
    source?: string;
    importance?: number;
    domain?: string;
    workspaceId?: string;
    sessionId?: string;
  }): Promise<Memory> {
    // Duplicate prevention: check if identical content exists
    const trimmedContent = data.content.trim();
    const existing = await this.repository.findDuplicate(
      trimmedContent,
      data.type,
    );
    if (existing && existing.key !== data.key) {
      this.logger.log(
        `Duplicate memory rejected: "${trimmedContent.substring(0, 50)}..." (existing: ${existing.key})`,
      );
      return existing;
    }

    return this.repository.upsert(data);
  }

  /**
   * Get memory context for system prompt injection (frozen snapshot).
   * Returns top memories formatted for injection, filtered by domain.
   * This is the AUTO-INJECTION method — called once at session start.
   */
  async getMemoryContext(
    domain?: string,
    workspaceId?: string,
    maxChars = 3000,
  ): Promise<string> {
    const memories = await this.findRelevant(domain, workspaceId, 20);
    if (memories.length === 0) return '';

    const lines: string[] = [];

    for (const m of memories) {
      const prefix = m.workspaceId ? '[Workspace]' : '[Global]';
      const line = `${prefix} ${m.key}: ${m.content}`;

      // Check if adding this memory would exceed budget
      if (lines.join('\n').length + line.length > maxChars) {
        break;
      }

      lines.push(line);
    }

    this.logger.log(
      `Injected ${lines.length} memories (domain: ${domain || 'any'}, workspace: ${workspaceId || 'global'})`,
    );

    return lines.join('\n');
  }

  /**
   * Record user preference with domain awareness.
   */
  async recordPreference(
    key: string,
    value: string,
    workspaceId?: string,
    domain?: string,
  ): Promise<Memory> {
    return this.remember({
      type: 'preference',
      key,
      content: value,
      source: 'auto',
      importance: 7,
      domain,
      workspaceId,
    });
  }

  /**
   * Record a business fact with domain awareness.
   */
  async recordBusinessFact(
    key: string,
    fact: string,
    domain: string,
    workspaceId?: string,
  ): Promise<Memory> {
    return this.remember({
      type: 'business_fact',
      key,
      content: fact,
      source: 'auto',
      importance: 8,
      domain,
      workspaceId,
    });
  }

  /**
   * Record a correction (user corrected agent behavior).
   */
  async recordCorrection(
    key: string,
    correction: string,
    workspaceId?: string,
    domain?: string,
  ): Promise<Memory> {
    return this.remember({
      type: 'correction',
      key,
      content: correction,
      source: 'auto',
      importance: 9, // High importance — corrections are critical
      domain,
      workspaceId,
    });
  }

  /**
   * Record workspace interaction.
   */
  async recordInteraction(
    workspaceId: string,
    task: string,
    result: string,
    domain?: string,
  ): Promise<Memory> {
    const key = `interaction_${workspaceId}_${Date.now()}`;
    return this.remember({
      type: 'interaction',
      key,
      content: `Task: ${task}\nResult: ${result}`,
      source: 'auto',
      importance: 5,
      domain,
      workspaceId,
    });
  }

  /**
   * Record workspace history.
   */
  async recordWorkspaceHistory(
    workspaceId: string,
    summary: string,
    domain?: string,
  ): Promise<Memory> {
    const key = `history_${workspaceId}`;
    return this.remember({
      type: 'workspace_history',
      key,
      content: summary,
      source: 'auto',
      importance: 6,
      domain,
      workspaceId,
    });
  }

  /**
   * Get user preferences.
   */
  async getPreferences(workspaceId?: string): Promise<Memory[]> {
    const memories = workspaceId
      ? await this.findForWorkspace(workspaceId)
      : await this.findActive();
    return memories.filter((m) => m.type === 'preference');
  }
}
