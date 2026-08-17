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
//
// When the caller passes the active model's context window, thresholds scale
// to it (OpenClaw compaction.ts): trigger at 75% of the window, keep 50% as a
// recent tail, cap the summary input at 60%. A 32K-window model therefore
// compacts around 24K tokens instead of the fixed 60K default — the LLM is
// never handed a bloated history that exceeds its real window.
const DEFAULT_MAX_TOTAL_TOKENS = 60_000;
const DEFAULT_RECENT_TOKENS_BUDGET = 24_000;
const DEFAULT_MAX_SUMMARY_INPUT_TOKENS = 30_000;

function thresholdsFor(contextWindow?: number): {
  maxTotal: number;
  recentBudget: number;
  maxSummaryInput: number;
} {
  if (!contextWindow) {
    return {
      maxTotal: DEFAULT_MAX_TOTAL_TOKENS,
      recentBudget: DEFAULT_RECENT_TOKENS_BUDGET,
      maxSummaryInput: DEFAULT_MAX_SUMMARY_INPUT_TOKENS,
    };
  }
  return {
    maxTotal: Math.floor(contextWindow * 0.75),
    recentBudget: Math.floor(contextWindow * 0.5),
    maxSummaryInput: Math.floor(contextWindow * 0.6),
  };
}

const LLM_SUMMARY_INSTRUCTIONS = `Compact the conversation history into a single cohesive summary.

MUST PRESERVE:
- Active tasks and their status (in-progress, completed, pending)
- All physical filenames, paths, UUIDs, IDs, and numbers
- User's latest request and actions already performed
- Decisions made and rationale
- User constraints and preferences

Prioritize the most recent context over older history. Format as a user-role message with wrapper tags [COMPACTED HISTORY].`;

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
    contextWindow?: number,
  ): Promise<CompactionResult> {
    const { maxTotal, recentBudget, maxSummaryInput } =
      thresholdsFor(contextWindow);
    const totalTokens = messages.reduce(
      (sum, m) => sum + countTokens(m.content ?? ''),
      0,
    );
    if (totalTokens <= maxTotal) {
      return { compactedMessages: messages, wasCompacted: false };
    }

    this.logger.log(
      `Compaction Engine: Compacting ${messages.length} messages (${totalTokens} tokens${contextWindow ? `, window ${contextWindow}` : ''}) down to recent turns + summary boundary`,
    );

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const { recentMessages, olderMessages } =
      this.splitRecentByTokens(nonSystemMessages, recentBudget);

    if (this.useLlmSummary) {
      return this.compactWithLLM(
        systemMessages,
        olderMessages,
        recentMessages,
        maxSummaryInput,
      );
    }

    return this.compactWithSummary(systemMessages, olderMessages, recentMessages);
  }

  /**
   * Split non-system messages into recent/older by token budget instead of a
   * fixed count — keeps ~recentBudget tokens of live context (Gap #14).
   */
  private splitRecentByTokens(
    messages: ChatMessage[],
    recentBudget: number,
  ): {
    recentMessages: ChatMessage[];
    olderMessages: ChatMessage[];
  } {
    const recentMessages: ChatMessage[] = [];
    let used = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const content = messages[i].content ?? '';
      const tokens = countTokens(content);
      if (used + tokens > recentBudget && recentMessages.length >= 2) {
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
    maxSummaryInput: number,
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
        if (used + lineTokens > maxSummaryInput && keptLines.length > 0) {
          this.logger.warn(
            `Compaction input truncated at ${maxSummaryInput} tokens (${olderMessages.length} messages → ${keptLines.length} lines)`,
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
            { role: 'user', content: `Compact the following history into a concise summary:\n\n${olderTexts}` },
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
        `Compaction: LLM summary failed (${err.message}). Falling back to COMPACTION SUMMARY (non-LLM).`,
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
        const scanText = msg.content.length > 5000 ? msg.content.slice(0, 5000) : msg.content;
        const matches = scanText.match(/[a-zA-Z0-9_\-.]+\.(?:txt|xlsx|pdf|docx|csv|json|md)\b/gi);
        if (matches) {
          matches.forEach((f: string) => touchedFiles.add(f));
        }
      }
    }

    const summaryText = `[COMPACTION SUMMARY]
- Previous Conversation Summary: ${userPrompts.slice(-3).join(' | ')}
- Touched Files: ${Array.from(touchedFiles).join(', ') || 'N/A'}
- Note: Older history has been summarized to conserve AI context memory.`;

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