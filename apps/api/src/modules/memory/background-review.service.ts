import { Injectable, Logger } from '@nestjs/common';
import { MemoryService } from './memory.service.js';

/**
 * BackgroundReviewService — auto-learn after every turn.
 *
 * Inspired by Hermes's background_review that runs after every agent turn.
 * Extracts new facts, preferences, and corrections from conversations
 * and automatically saves them to memory.
 *
 * This ensures memory stays fresh and relevant without manual intervention.
 */
@Injectable()
export class BackgroundReviewService {
  private readonly logger = new Logger(BackgroundReviewService.name);

  constructor(private readonly memoryService: MemoryService) {}

  /**
   * Review a conversation turn and extract learnable information.
   * Called after each chat/workspace completion.
   *
   * @param messages - Recent conversation messages
   * @param workspaceId - Optional workspace ID
   * @param domain - Business domain (garment, restaurant, retail, generic)
   */
  async reviewAndLearn(
    messages: Array<{ role: string; content: string }>,
    workspaceId?: string,
    domain = 'generic',
  ): Promise<void> {
    try {
      // Only review if there's meaningful content
      const userMessages = messages.filter((m) => m.role === 'user');
      const assistantMessages = messages.filter((m) => m.role === 'assistant');

      if (userMessages.length === 0 || assistantMessages.length === 0) {
        return;
      }

      // Extract learnable information from the conversation
      const learnings = this.extractLearnings(messages);

      // Save each learning to memory
      for (const learning of learnings) {
        await this.saveLearning(learning, workspaceId, domain);
      }

      if (learnings.length > 0) {
        this.logger.log(`Background review: extracted ${learnings.length} learnings`);
      }
    } catch (err: any) {
      this.logger.warn(`Background review failed: ${err.message}`);
    }
  }

  /**
   * Extract learnable information from messages.
   * Returns array of learnings with type, key, content, and importance.
   */
  private extractLearnings(
    messages: Array<{ role: string; content: string }>
  ): Array<{
    type: string;
    key: string;
    content: string;
    importance: number;
  }> {
    const learnings: Array<{
      type: string;
      key: string;
      content: string;
      importance: number;
    }> = [];

    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // Detect corrections (user corrected the agent)
    const correctionPatterns = [
      /(?:salah|wrong|bukan|not|ga|gak|tidak)\s+(?:begini|gitu|seperti|like)\s+(.+)/i,
      /(?:seharusnya|should be|actually|actually)\s+(.+)/i,
      /(?:jangan|don't|don't)\s+(.+)/i,
      /(?:ganti|change|replace|update)\s+(?:ke|to)\s+(.+)/i,
    ];

    for (const pattern of correctionPatterns) {
      const match = conversationText.match(pattern);
      if (match) {
        learnings.push({
          type: 'correction',
          key: `correction-${Date.now()}`,
          content: match[0].substring(0, 200),
          importance: 9,
        });
        break;
      }
    }

    // Detect preferences (user expressed a preference)
    const preferencePatterns = [
      /(?:suka|like|prefer|pilih|gunakan|use)\s+(.+)/i,
      /(?:jangan pakai|avoid|don't use)\s+(.+)/i,
      /(?:selalu|always)\s+(.+)/i,
      /(?:tidak pernah|never)\s+(.+)/i,
    ];

    for (const pattern of preferencePatterns) {
      const match = conversationText.match(pattern);
      if (match) {
        learnings.push({
          type: 'preference',
          key: `preference-${Date.now()}`,
          content: match[0].substring(0, 200),
          importance: 7,
        });
        break;
      }
    }

    // Detect business facts (user mentioned specific business info)
    const businessPatterns = [
      /(?:harga|price|rp|idr)\s*[:=]?\s*(.+)/i,
      /(?:stok|stock|inventory)\s*[:=]?\s*(.+)/i,
      /(?:pelanggan|customer|client)\s*[:=]?\s*(.+)/i,
      /(?:supplier|vendor)\s*[:=]?\s*(.+)/i,
      /(?:produk|product|barang)\s*[:=]?\s*(.+)/i,
    ];

    for (const pattern of businessPatterns) {
      const match = conversationText.match(pattern);
      if (match) {
        learnings.push({
          type: 'business_fact',
          key: `business-${Date.now()}`,
          content: match[0].substring(0, 200),
          importance: 8,
        });
        break;
      }
    }

    return learnings;
  }

  /**
   * Save a learning to memory with duplicate prevention.
   */
  private async saveLearning(
    learning: {
      type: string;
      key: string;
      content: string;
      importance: number;
    },
    workspaceId?: string,
    domain?: string,
  ): Promise<void> {
    try {
      await this.memoryService.remember({
        type: learning.type,
        key: learning.key,
        content: learning.content,
        source: 'auto',
        importance: learning.importance,
        domain: domain || 'generic',
        workspaceId,
      });
    } catch (err: any) {
      // Duplicate prevention — expected behavior
      if (err.message?.includes('duplicate') || err.code === 'P2002') {
        this.logger.debug(`Duplicate learning skipped: ${learning.key}`);
      } else {
        this.logger.warn(`Failed to save learning: ${err.message}`);
      }
    }
  }
}
