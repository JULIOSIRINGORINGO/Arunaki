import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { MemoryService } from '../memory/memory.service.js';
import { AiService, ChatMessage } from '../ai/ai.service.js';

export interface DistilledMemory {
  key: string;
  summary: string;
  importance: number;
  category: 'pattern' | 'preference' | 'fact' | 'insight';
  sourceCount: number;
  distilledAt: Date;
}

/**
 * AutoMemoryService — Automatic Memory Distillation.
 *
 * OpenClaw Pattern: After accumulating many raw memories,
 * periodically distill/compress them into higher-quality summaries.
 * This prevents memory bloat and improves retrieval relevance.
 *
 * Arunaki Adaptation:
 * - Compresses recent memories into themes/patterns
 * - Removes redundant entries
 * - Promotes high-value learnings
 * - Runs after configurable threshold (default: 50 memories)
 */
@Injectable()
export class AutoMemoryService {
  private readonly logger = new Logger(AutoMemoryService.name);

  /** Distillation triggers when memory count exceeds this threshold */
  private readonly DISTILLATION_THRESHOLD = 50;

  /** Maximum memories to process per distillation cycle */
  private readonly MAX_BATCH_SIZE = 100;

  constructor(
    private readonly memoryService: MemoryService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
  ) {}

  /**
   * Check if distillation is needed and run if threshold exceeded.
   * Called by CronService or after bulk memory operations.
   */
  async checkAndDistill(
    workspaceId?: string,
    domain = 'generic',
  ): Promise<{ distilled: boolean; count: number }> {
    try {
      // Get memory count
      const memories = await this.memoryService.findRelevant(
        domain,
        workspaceId,
        this.MAX_BATCH_SIZE,
      );

      if (memories.length < this.DISTILLATION_THRESHOLD) {
        return { distilled: false, count: memories.length };
      }

      this.logger.log(
        `Distillation triggered: ${memories.length} memories exceed threshold ${this.DISTILLATION_THRESHOLD}`,
      );

      const rawMemories = memories.map((m) => ({
        key: m.key,
        content: m.content,
        type: m.type,
        importance: m.importance ?? undefined,
      }));

      const distilled = await this.distill(rawMemories, workspaceId, domain);

      return { distilled: true, count: distilled.length };
    } catch (err: any) {
      this.logger.warn(`Memory distillation check failed: ${err.message}`);
      return { distilled: false, count: 0 };
    }
  }

  /**
   * Distill a batch of raw memories into compressed summaries.
   * Uses LLM to identify patterns, merge duplicates, and extract insights.
   */
  async distill(
    memories: Array<{ key: string; content: string; type: string; importance?: number }>,
    workspaceId?: string,
    domain = 'generic',
  ): Promise<DistilledMemory[]> {
    if (memories.length === 0) return [];

    // Group memories by type for better distillation
    const groups: Record<string, typeof memories> = {};
    for (const mem of memories) {
      const type = mem.type || 'unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(mem);
    }

    const allDistilled: DistilledMemory[] = [];

    for (const [type, groupMemories] of Object.entries(groups)) {
      if (groupMemories.length < 3) continue; // Only distill groups with 3+

      try {
        const distilled = await this.distillGroup(type, groupMemories);
        allDistilled.push(...distilled);
      } catch (err: any) {
        this.logger.warn(`Failed to distill group "${type}": ${err.message}`);
      }
    }

    // Store distilled memories
    for (const dm of allDistilled) {
      try {
        await this.memoryService.remember({
          type: `distilled_${dm.category}`,
          key: dm.key,
          content: dm.summary,
          source: 'distillation',
          importance: dm.importance,
          domain,
          workspaceId,
        });
      } catch (err: any) {
        // Duplicate key — expected when re-distilling
        if (!err.message?.includes('duplicate') && err.code !== 'P2002') {
          this.logger.warn(`Failed to store distilled memory: ${err.message}`);
        }
      }
    }

    this.logger.log(
      `Distillation complete: ${memories.length} raw → ${allDistilled.length} distilled`,
    );

    return allDistilled;
  }

  /**
   * Distill a single group of same-type memories using LLM.
   */
  private async distillGroup(
    type: string,
    memories: Array<{ key: string; content: string; importance?: number }>,
  ): Promise<DistilledMemory[]> {
    const memoryText = memories
      .map((m, i) => `[${i + 1}] (importance: ${m.importance || 5}) ${m.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Kamu adalah Memory Distillation Agent.
Tugasmu: kompres dan rangkum kumpulan memori mentah menjadi poin-poin ringkas.

Tipe memori: ${type}
Jumlah memori mentah: ${memories.length}

ATURAN:
- Gabungkan memori yang duplikat atau hampir sama
- Identifikasi pola dan tema utama
- Prioritaskan informasi dengan importance tinggi
- Buang noise (memori tidak penting/berulang)
- Setiap poin ringkasan harus actionable dan spesifik
- Maksimal 10 poin ringkasan

Respond dalam JSON:
{
  "distilled": [
    {
      "key": "unique-key",
      "summary": "ringkasan padat",
      "importance": 1-10,
      "category": "pattern|preference|fact|insight",
      "sourceCount": jumlah memori sumber
    }
  ]
}`,
      },
      { role: 'user', content: memoryText },
    ];

    const response = await this.aiService.chat(messages, []);
    const parsed = this.parseJsonFromResponse(response.content);

    return (parsed.distilled || []).map((d: any) => ({
      key: d.key || `distilled-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      summary: d.summary || '',
      importance: Math.min(10, Math.max(1, d.importance || 7)),
      category: d.category || 'insight',
      sourceCount: d.sourceCount || memories.length,
      distilledAt: new Date(),
    }));
  }

  /**
   * Parse JSON from LLM response text (handles markdown code blocks).
   */
  private parseJsonFromResponse(text: string): any {
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    }
    return JSON.parse(cleaned);
  }
}
