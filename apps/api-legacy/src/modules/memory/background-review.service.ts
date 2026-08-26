import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MemoryService } from './memory.service.js';
import { SkillSelfImproveService } from '../skills/skill-self-improve.service.js';
import { AiService } from '../ai/ai.service.js';

/**
 * BackgroundReviewService — auto-learn after every turn.
 *
 * Inspired by OpenClaw's background_review that runs after every agent turn.
 * Extracts new facts, preferences, and corrections from conversations via LLM
 * and automatically saves them to memory without false-positive regex pollution.
 */
@Injectable()
export class BackgroundReviewService {
  private readonly logger = new Logger(BackgroundReviewService.name);

  constructor(
    @Inject(forwardRef(() => MemoryService))
    private readonly memoryService: MemoryService,
    @Inject(forwardRef(() => SkillSelfImproveService))
    private readonly skillSelfImproveService: SkillSelfImproveService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Optional()
    @Inject(forwardRef(() => AiService))
    private readonly aiService?: AiService,
  ) {}

  /**
   * Review a conversation turn and extract learnable information.
   * Called after each chat/workspace completion.
   */
  async reviewAndLearn(
    messages: Array<{ role: string; content: string }>,
    workspaceId?: string,
    domain = 'generic',
  ): Promise<void> {
    try {
      const userMessages = messages.filter((m) => m.role === 'user');
      const assistantMessages = messages.filter((m) => m.role === 'assistant');

      if (userMessages.length === 0 || assistantMessages.length === 0) {
        return;
      }

      // Extract learnable information via LLM to prevent false positives
      const learnings = await this.extractLearningsViaLlm(messages);
      if (learnings.length === 0) return;

      const savedLearnings: Array<{
        type: string;
        content: string;
        workspaceId?: string;
        domain?: string;
        importance: number;
      }> = [];

      for (const learning of learnings) {
        await this.saveLearning(learning, workspaceId, domain);
        savedLearnings.push({
          type: learning.type,
          content: learning.content,
          workspaceId,
          domain,
          importance: learning.importance,
        });
      }

      if (savedLearnings.length > 0) {
        await this.skillSelfImproveService.improveSkillsFromLessons(
          savedLearnings as Array<{
            type: 'preference' | 'business_fact' | 'correction';
            content: string;
            workspaceId?: string;
            domain?: string;
            importance: number;
          }>,
        );
      }

      this.logger.log(
        `[BackgroundReview] Extracted & saved ${savedLearnings.length} verified learnings.`,
      );
    } catch (err: any) {
      this.logger.warn(
        `[BackgroundReview] Review non-fatal error: ${err.message}`,
      );
    }
  }

  /**
   * Extract learnable facts and preferences using LLM reasoning (0% dumb regex).
   */
  private async extractLearningsViaLlm(
    messages: Array<{ role: string; content: string }>,
  ): Promise<
    Array<{
      type: string;
      key: string;
      content: string;
      importance: number;
    }>
  > {
    let ai = this.aiService;
    if (!ai) {
      try {
        ai = this.moduleRef.get(AiService, { strict: false });
      } catch {
        // AI service unavailable
      }
    }

    if (!ai) return [];

    try {
      const conversationText = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const prompt = `Review this conversation turn:
${conversationText.slice(0, 1500)}

TASK:
Determine if the user stated any genuine, permanent business facts or working preferences.
- If the conversation is casual banter, ordinary work execution, or general talk, output strictly "[]".
- If genuine facts or preferences were stated, return a JSON array:
[{"type": "preference" | "business_fact" | "correction", "content": "concise description", "importance": 8}]

Output ONLY the raw JSON array without markdown fences.`;

      const response = await ai.chat([
        {
          role: 'system',
          content:
            'You are an AI memory extraction agent. Never generate false positives for normal conversation.',
        },
        { role: 'user', content: prompt },
      ]);

      const raw = (response?.content || '')
        .trim()
        .replace(/```json|```/g, '')
        .trim();
      if (!raw || raw === '[]' || !raw.startsWith('[')) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (item) =>
            item &&
            typeof item.content === 'string' &&
            item.content.trim().length > 3,
        )
        .map((item, idx) => ({
          type: item.type || 'preference',
          key: `learning-${Date.now()}-${idx}`,
          content: item.content.trim().slice(0, 200),
          importance: typeof item.importance === 'number' ? item.importance : 7,
        }));
    } catch {
      return [];
    }
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
      if (err.message?.includes('duplicate') || err.code === 'P2002') {
        this.logger.debug(`Duplicate learning skipped: ${learning.key}`);
      } else {
        this.logger.warn(`Failed to save learning: ${err.message}`);
      }
    }
  }
}
