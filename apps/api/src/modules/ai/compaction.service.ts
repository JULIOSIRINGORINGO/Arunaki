import { Injectable, Logger } from '@nestjs/common';
import type { ChatMessage } from './ai.service.js';

export interface CompactionResult {
  compactedMessages: ChatMessage[];
  wasCompacted: boolean;
  summary?: string;
}

const MERGE_SUMMARIES_INSTRUCTIONS = `Merge prior conversation history into a single cohesive summary.

MUST PRESERVE EXACTLY:
- Active tasks and their current status (in-progress, completed, pending)
- All physical file names, paths, UUIDs, IDs, and numbers
- The last thing the user requested and what was done about it
- Decisions made and their rationale
- Constraints and user preferences

PRIORITIZE recent context over older history. The agent needs to know what it was doing and which files it touched.`;

@Injectable()
export class CompactionService {
  private readonly logger = new Logger(CompactionService.name);

  /**
   * Compact conversation message history when message count exceeds threshold
   */
  compactHistory(messages: ChatMessage[], maxTurns = 20): CompactionResult {
    if (messages.length <= maxTurns) {
      return {
        compactedMessages: messages,
        wasCompacted: false,
      };
    }

    this.logger.log(`Compaction Engine: Compacting ${messages.length} messages down to recent turns + summary boundary`);

    // Separate system prompt, older history, and recent turns
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Keep last 10 turns intact
    const recentMessages = nonSystemMessages.slice(-10);
    const olderMessages = nonSystemMessages.slice(0, -10);

    // Extract facts & identifiers from older messages
    const touchedFiles = new Set<string>();
    const userPrompts: string[] = [];

    for (const msg of olderMessages) {
      if (msg.role === 'user' && typeof msg.content === 'string') {
        userPrompts.push(msg.content);
      }

      // Extract file paths from messages
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
    return MERGE_SUMMARIES_INSTRUCTIONS;
  }
}
