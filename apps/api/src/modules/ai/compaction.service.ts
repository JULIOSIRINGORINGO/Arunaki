import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import type { ChatMessage } from './ai.service.js';
import { AiService } from './ai.service.js';
import { countTokens } from './tokenizer.js';

export interface CompactionResult {
  compactedMessages: ChatMessage[];
  wasCompacted: boolean;
  summary?: string;
}

// Token-based thresholds (Gap #14/#15): compaction triggers on accumulated
// tokens, not raw message count, and the LLM summary input is capped so the
// summarization call itself cannot overflow context.
const MAX_TOTAL_TOKENS = 60_000;
const RECENT_TOKENS_BUDGET = 24_000;
const MAX_SUMMARY_INPUT_TOKENS = 30_000;

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
  ): Promise<CompactionResult> {
    const totalTokens = messages.reduce(
      (sum, m) => sum + countTokens(m.content ?? ''),
      0,
    );
    if (totalTokens <= MAX_TOTAL_TOKENS) {
      return { compactedMessages: messages, wasCompacted: false };
    }

    this.logger.log(
      `Compaction Engine: Compacting ${messages.length} messages (${totalTokens} tokens) down to recent turns + summary boundary`,
    );

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const { recentMessages, olderMessages } =
      this.splitRecentByTokens(nonSystemMessages);

    if (this.useLlmSummary) {
      return this.compactWithLLM(systemMessages, olderMessages, recentMessages);
    }

    return this.compactWithSummary(systemMessages, olderMessages, recentMessages);
  }

  /**
   * Split non-system messages into recent/older by token budget instead of a
   * fixed count — keeps ~RECENT_TOKENS_BUDGET tokens of live context (Gap #14).
   */
  private splitRecentByTokens(messages: ChatMessage[]): {
    recentMessages: ChatMessage[];
    olderMessages: ChatMessage[];
  } {
    const recentMessages: ChatMessage[] = [];
    let used = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const content = messages[i].content ?? '';
      const tokens = countTokens(content);
      if (used + tokens > RECENT_TOKENS_BUDGET && recentMessages.length >= 2) {
        break;
      }
      recentMessages.unshift(messages[i]);
      used += tokens;
    }
    const olderMessages = messages.slice(0, messages.length - recentMessages.length);
    return { recentMessages, olderMessages };
  }

  private async compactWithLLM(
    systemMessages: ChatMessage[],
    olderMessages: ChatMessage[],
    recentMessages: ChatMessage[],
  ): Promise<CompactionResult> {
    try {
      // Cap the summary input so the LLM call cannot overflow context even when
      // olderMessages is large (Gap #15). Walks message-by-message so truncation
      // stays on message boundaries.
      const keptLines: string[] = [];
      let used = 0;
      for (const msg of olderMessages) {
        const line = `[${msg.role}] ${msg.content || ''}`;
        const lineTokens = countTokens(line);
        if (used + lineTokens > MAX_SUMMARY_INPUT_TOKENS && keptLines.length > 0) {
          this.logger.warn(
            `Compaction input truncated at ${MAX_SUMMARY_INPUT_TOKENS} tokens (${olderMessages.length} messages → ${keptLines.length} lines)`,
          );
          break;
        }
        keptLines.push(line);
        used += lineTokens;
      }
      const olderTexts = keptLines.join('\n');

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
        role: 'user',
        content: `[COMPACTED HISTORY]\n${summary}\n[END COMPACTED HISTORY]`,
      };

      return {
        compactedMessages: [...systemMessages, summaryMessage, ...recentMessages],
        wasCompacted: true,
        summary,
      };
    } catch (err: any) {
      this.logger.warn(
        `Compaction: LLM summary gagal (${err.message}). FALLBACK ke COMPACTION SUMMARY (non-LLM).`,
      );
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
      role: 'user',
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