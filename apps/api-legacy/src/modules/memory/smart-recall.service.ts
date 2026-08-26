import { Injectable, Logger } from '@nestjs/common';
import { MemoryService } from './memory.service.js';
import { SessionSearchService } from './session-search.service.js';

/**
 * SmartRecallService â€” prefetch relevant context before task.
 *
 * Inspired OpenClaw's smart memory recall. Before executing a task,
 * the agent searches memory and past conversations for relevant
 * context to inform its approach.
 *
 * Flow:
 * 1. Extract keywords from user goal
 * 2. Search memory for relevant entries
 * 3. Search past sessions for relevant conversations
 * 4. Compile and inject into system prompt
 */
@Injectable()
export class SmartRecallService {
  private readonly logger = new Logger(SmartRecallService.name);

  /** Max chars for injected recall context */
  private readonly MAX_RECALL_CHARS = 2000;

  constructor(
    private readonly memoryService: MemoryService,
    private readonly sessionSearchService: SessionSearchService,
  ) {}

  /**
   * Recall relevant context for a given goal.
   * Returns formatted context string for system prompt injection.
   */
  async recall(
    goal: string,
    workspaceId?: string,
    domain?: string,
  ): Promise<string> {
    try {
      const parts: string[] = [];

      // 1. Extract keywords from goal
      const keywords = this.extractKeywords(goal);

      // 2. Search memory for relevant entries
      const memoryContext = await this.searchMemory(
        keywords,
        workspaceId,
        domain,
      );
      if (memoryContext) {
        parts.push(memoryContext);
      }

      // 3. Search past sessions for relevant conversations
      const sessionContext = await this.searchSessions(keywords, workspaceId);
      if (sessionContext) {
        parts.push(sessionContext);
      }

      if (parts.length === 0) return '';

      const context = parts.join('\n\n');

      // Enforce char limit
      if (context.length > this.MAX_RECALL_CHARS) {
        return context.substring(0, this.MAX_RECALL_CHARS) + '\n[...truncated]';
      }

      return context;
    } catch (err: any) {
      this.logger.warn(`Smart recall failed: ${err.message}`);
      return '';
    }
  }

  /**
   * Extract keywords from goal text.
   */
  private extractKeywords(goal: string): string[] {
    // Simple keyword extraction: split by spaces, filter common words
    const stopWords = new Set([
      // Indonesian function words (users write goals in ID, EN, or mix)
      'apa',
      'apakah',
      'bagaimana',
      'kenapa',
      'mengapa',
      'kapan',
      'dimana',
      'siapa',
      'ke',
      'dari',
      'saya',
      'kami',
      'anda',
      'kamu',
      'mereka',
      'dia',
      'akan',
      'sudah',
      'telah',
      'sedang',
      'bisa',
      'dapat',
      'harus',
      'tidak',
      'bukan',
      'jangan',
      'ada',
      'atas',
      'bawah',
      'antara',
      'semua',
      'setiap',
      'lebih',
      'paling',
      'tolong',
      'mohon',
      'coba',
      'aja',
      'saja',
      'yah',
      'yang',
      'di',
      'dan',
      'untuk',
      'dengan',
      'pada',
      'adalah',
      'ini',
      'itu',
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'shall',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'out',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'both',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'because',
      'but',
      'and',
      'or',
    ]);

    const words = goal
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    // Return top 5 unique keywords
    return [...new Set(words)].slice(0, 5);
  }

  /**
   * Search memory for relevant entries.
   */
  private async searchMemory(
    keywords: string[],
    workspaceId?: string,
    domain?: string,
  ): Promise<string> {
    if (keywords.length === 0) return '';

    const query = keywords.join(' ');
    // Default to a safe string if workspaceId is not provided to satisfy the type.
    // The repository handles empty workspaceId safely.
    const memories = await this.memoryService.search(query, workspaceId || '');
    if (process.env.ARUNAKI_DEBUG_TOOLS === '1') {
      this.logger.debug(
        `[TRACE-MEMORY-SEARCH] q="${query}" ws=${workspaceId} hits=${memories.length} types=${memories.map((m) => m.type).join('|')}`,
      );
    }

    if (memories.length === 0) return '';

    // Ephemeral bookkeeping types (run summaries, history dumps) are stored
    // for analytics but are noise as "relevant memory" context â€” and their
    // volume would crowd out real user preferences/facts.
    const EPHEMERAL_TYPES = new Set(['run_summary', 'workspace_history']);
    const relevant = memories.filter((m) => !EPHEMERAL_TYPES.has(m.type));

    const lines = relevant.slice(0, 5).map((m) => {
      const preview = m.content.substring(0, 100);
      return `- [${m.type}] ${m.key}: ${preview}`;
    });

    if (lines.length === 0) return '';

    return `## Relevant Memory\n${lines.join('\n')}`;
  }

  /**
   * Search past sessions for relevant conversations.
   */
  private async searchSessions(
    keywords: string[],
    workspaceId?: string,
  ): Promise<string> {
    if (keywords.length === 0) return '';

    const query = keywords.join(' ');
    const results = await this.sessionSearchService.search(query, {
      workspaceId,
      limit: 3,
      role: 'assistant',
    });

    if (results.length === 0) return '';

    const lines = results.map((r) => {
      const preview = r.snippet
        .replace(/>>>/g, '')
        .replace(/<<</g, '')
        .substring(0, 100);
      return `- ${preview}`;
    });

    return `## Relevant Past Conversations\n${lines.join('\n')}`;
  }
}

