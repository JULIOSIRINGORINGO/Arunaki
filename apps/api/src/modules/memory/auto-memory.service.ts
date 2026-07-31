import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../common/providers/prisma.service.js';
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

export interface MergedMemory {
  key: string;
  content: string;
  type: string;
  importance: number;
  domain?: string;
  workspaceId?: string;
  source: string;
}

/**
 * AutoMemoryService — Automatic Memory Distillation & Consolidation.
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
 * - NEW: mergeSimilarMemories() — consolidate similar/duplicate memories via LLM
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
    private readonly prisma: PrismaService,
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
    memories: Array<{
      key: string;
      content: string;
      type: string;
      importance?: number;
    }>,
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

    // Store distilled memories and retire their sources so the raw count converges
    const consumedKeys: string[] = [];
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

    // Deactivate raw memories that were distilled (group >= 3 members only)
    if (allDistilled.length > 0) {
      for (const [type, groupMemories] of Object.entries(groups)) {
        if (groupMemories.length < 3) continue;
        consumedKeys.push(...groupMemories.map((m) => m.key));
      }
      if (consumedKeys.length > 0) {
        await this.prisma.memory.updateMany({
          where: { key: { in: consumedKeys }, active: true },
          data: { active: false },
        });
      }
    }

    this.logger.log(
      `Distillation complete: ${memories.length} raw → ${allDistilled.length} distilled`,
    );

    return allDistilled;
  }

  /**
   * Merge similar/duplicate memories via LLM consolidation.
   * Finds memories with overlapping content and combines them.
   */
  async mergeSimilarMemories(
    workspaceId?: string,
    domain?: string,
    similarityThreshold = 0.7,
  ): Promise<{ merged: number; removed: number }> {
    try {
      // Get all memories for this workspace/domain
      const memories = await this.memoryService.findRelevant(
        domain,
        workspaceId,
        200, // Get more for merging
      );

      if (memories.length < 10) {
        return { merged: 0, removed: 0 };
      }

      this.logger.log(
        `Memory consolidation: analyzing ${memories.length} memories for merging...`,
      );

      // Group by type for focused merging
      const byType: Record<string, typeof memories> = {};
      for (const m of memories) {
        if (!byType[m.type]) byType[m.type] = [];
        byType[m.type].push(m);
      }

      let totalMerged = 0;
      let totalRemoved = 0;

      for (const [type, typeMemories] of Object.entries(byType)) {
        if (typeMemories.length < 5) continue;

        const result = await this.mergeMemoriesInGroup(type, typeMemories);
        totalMerged += result.merged;
        totalRemoved += result.removed;
      }

      this.logger.log(
        `Memory consolidation complete: ${totalMerged} merged, ${totalRemoved} removed`,
      );

      return { merged: totalMerged, removed: totalRemoved };
    } catch (err: any) {
      this.logger.warn(`Memory merge failed: ${err.message}`);
      return { merged: 0, removed: 0 };
    }
  }

  /**
   * Merge memories within a single type group.
   * Uses LLM to identify similar content and create consolidated entries.
   */
  private async mergeMemoriesInGroup(
    type: string,
    memories: Array<{
      id: string;
      key: string;
      content: string;
      importance: number | null;
    }>,
  ): Promise<{ merged: number; removed: number }> {
    const memoryText = memories
      .map((m, i) => `[${i + 1}] ID:${m.id} Key:${m.key} Imp:${m.importance || 5} ${m.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Kamu adalah Memory Consolidation Agent.
Tugas: identifikasi memori yang mirip/duplikat dan gabungkan menjadi satu entri yang lebih lengkap.

Tipe memori: ${type}
Jumlah memori: ${memories.length}

ATURAN:
- Gabungkan memori yang berisi informasi sama atau tumpang tindih
- Pertahankan detail penting dari masing-masing
- Buang noise/pengulangan
- Setiap hasil gabungan harus lebih lengkap dan actionable
- Maksimal 15 hasil gabungan

Respond dalam JSON:
{
  "merged": [
    {
      "ids": ["id1", "id2"],  // IDs memori yang digabung
      "key": "new-key",
      "content": "konten gabungan yang lengkap",
      "importance": 1-10,
      "reason": "alasan penggabungan"
    }
  ]
}`,
      },
      { role: 'user', content: memoryText },
    ];

    const response = await this.aiService.chat(messages, []);
    const parsed = this.parseJsonFromResponse(response.content);

    let merged = 0;
    let removed = 0;

    for (const merge of parsed.merged || []) {
      if (!merge.ids || merge.ids.length < 2) continue;

      try {
        // Keep the first one as primary, update its content in place
        const primaryId = merge.ids[0];
        const otherIds = merge.ids.slice(1);

        // Update primary with merged content (deactivate others so count converges)
        await this.prisma.memory.update({
          where: { id: primaryId },
          data: {
            content: merge.content,
            key: merge.key,
            importance: merge.importance,
            type: `consolidated_${type}`,
          },
        });

        // Soft-delete the other memories
        for (const otherId of otherIds) {
          await this.prisma.memory.update({
            where: { id: otherId },
            data: { active: false },
          });
          removed++;
        }

        merged++;
      } catch (err: any) {
        this.logger.warn(`Failed to merge group: ${err.message}`);
      }
    }

    return { merged, removed };
  }

  /**
   * Distill a single group of same-type memories using LLM.
   */
  private async distillGroup(
    type: string,
    memories: Array<{ key: string; content: string; importance?: number }>,
  ): Promise<DistilledMemory[]> {
    const memoryText = memories
      .map(
        (m, i) => `[${i + 1}] (importance: ${m.importance || 5}) ${m.content}`,
      )
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
      key:
        d.key ||
        `distilled-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
    let cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    }
    return JSON.parse(cleaned);
  }
}
