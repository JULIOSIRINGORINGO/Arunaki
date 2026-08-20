import { Injectable } from '@nestjs/common';

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TodoSnapshot {
  items: TodoItem[];
  updatedAt: Date;
}

/**
 * TodoStoreService — per-run working memory for todo/task lists.
 *
 * LLM writes/updates its plan via the `todo_write` tool; runners inject
 * the current list into context each round so the model stays anchored
 * across long runs (MAX_ROUNDS up to 25).
 */
@Injectable()
export class TodoStoreService {
  private readonly store = new Map<string, TodoSnapshot>();

  set(runId: string, items: TodoItem[]): TodoSnapshot {
    const snapshot: TodoSnapshot = { items, updatedAt: new Date() };
    this.store.set(runId, snapshot);
    return snapshot;
  }

  get(runId: string): TodoItem[] {
    return this.store.get(runId)?.items ?? [];
  }

  clear(runId: string): void {
    this.store.delete(runId);
  }

  has(runId: string): boolean {
    return this.store.has(runId);
  }

  serialize(runId: string): string {
    const items = this.get(runId);
    if (items.length === 0) return '';
    const lines = items.map((t) => `- [${t.status}] ${t.id}: ${t.content}`);
    return `=== TODO LIST ===\n${lines.join('\n')}\n=== END TODO LIST ===`;
  }
}
