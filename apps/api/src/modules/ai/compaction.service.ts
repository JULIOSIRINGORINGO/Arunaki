import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import type { ChatMessage } from './ai.service.js';
import { AiService } from './ai.service.js';

export interface CompactionResult {
  compactedMessages: ChatMessage[];
  wasCompacted: boolean;
  summary?: string;
}

const LLM_SUMMARY_INSTRUCTIONS = `Kompaksi riwayat percakapan menjadi satu ringkasan kohesif.

WAJIB DIpertahankan:
- Tugas aktif dan statusnya (in-progress, completed, pending)
- Semua nama file fisik, path, UUID, ID, dan angka
- Permintaan terakhir user dan apa yang sudah dilakukan
- Keputusan yang diambil beserta alasan
- Constraint dan preferensi user

UTAMAKAN konteks terakhir dibanding history lama. Format sebagai user-role message dengan wrapper tags [COMPACTED HISTORY].`;

@Injectable()
export class CompactionService {
  private readonly logger = new Logger(CompactionService.name);
  private readonly useLlmSummary: boolean;

  constructor(
    @Optional() @Inject(forwardRef(() => AiService)) private readonly aiService?: AiService,
  ) {
    this.useLlmSummary = !!aiService;
  }

  async compactHistory(
    messages: ChatMessage[],
    maxTurns = 20,
  ): Promise<CompactionResult> {
    if (messages.length <= maxTurns) {
      return { compactedMessages: messages, wasCompacted: false };
    }

    this.logger.log(
      `Compaction Engine: Compacting ${messages.length} messages down to recent turns + summary boundary`,
    );

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const recentMessages = nonSystemMessages.slice(-10);
    const olderMessages = nonSystemMessages.slice(0, -10);

    if (this.useLlmSummary) {
      return this.compactWithLLM(systemMessages, olderMessages, recentMessages);
    }

    return this.compactWithSummary(systemMessages, olderMessages, recentMessages);
  }

  private async compactWithLLM(
    systemMessages: ChatMessage[],
    olderMessages: ChatMessage[],
    recentMessages: ChatMessage[],
  ): Promise<CompactionResult> {
    try {
      const olderTexts = olderMessages
        .map((m) => `[${m.role}] ${m.content || ''}`)
        .filter(Boolean)
        .join('\n');

      const summary = (
        await this.aiService!.chat(
          [
            { role: 'system', content: LLM_SUMMARY_INSTRUCTIONS },
            { role: 'user', content: `Kompaksi riwayat berikut menjadi ringkasan ringkas:\n\n${olderTexts}` },
          ],
          [],
        )
      ).content;

      const summaryMessage: ChatMessage = {
        role: 'system',
        content: `[COMPACTED HISTORY]\n${summary}\n[END COMPACTED HISTORY]`,
      };

      return {
        compactedMessages: [...systemMessages, summaryMessage, ...recentMessages],
        wasCompacted: true,
        summary,
      };
    } catch (err: any) {
      this.logger.warn(`LLM compaction failed (${err.message}), falling back to summary`);
      return this.compactWithSummary(systemMessages, olderMessages, recentMessages);
    }
  }

  private compactWithSummary(
    systemMessages: ChatMessage[],
    olderMessages: ChatMessage[],
    recentMessages: ChatMessage[],
  ): CompactionResult {
    const touchedFiles = new Set<string>();
    const userPrompts: string[] = [];

    for (const msg of olderMessages) {
      if (msg.role === 'user' && typeof msg.content === 'string') {
        userPrompts.push(msg.content);
      }
      if (typeof msg.content === 'string') {
        const matches = msg.content.match(/[\w\-.]+\.(?:txt|xlsx|pdf|docx|csv|json|md)/gi);
        if (matches) {
          matches.forEach((f: string) => touchedFiles.add(f));
        }
      }
    }

    const summaryText = `[COMPACTION SUMMARY]
- Ringkasan Percakapan Sebelumnya: ${userPrompts.slice(-3).join(' | ')}
- Berkas Yang Tersentuh: ${Array.from(touchedFiles).join(', ') || 'N/A'}
- Catatan: Histori lama telah diringkas untuk menghemat memori konteks AI.`;

    const summaryMessage: ChatMessage = {
      role: 'system',
      content: summaryText,
    };

    return {
      compactedMessages: [...systemMessages, summaryMessage, ...recentMessages],
      wasCompacted: true,
      summary: summaryText,
    };
  }

  getCompactionInstructions(): string {
    return LLM_SUMMARY_INSTRUCTIONS;
  }
}