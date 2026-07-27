import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SkillService } from './skill.service.js';
import { AiService } from '../ai/ai.service.js';

/**
 * SkillSelfImproveService — skills auto-update from experience.
 *
 * Inspired OpenClaw's skill self-improvement. After background review
 * detects a pattern or correction, the skill can be updated automatically.
 *
 * Flow:
 * 1. Background review extracts lessons (corrections, preferences, facts)
 * 2. For each lesson, find relevant skill(s)
 * 3. Ask LLM to update skill content with new knowledge
 * 4. Version bump + track improvement history
 */
@Injectable()
export class SkillSelfImproveService {
  private readonly logger = new Logger(SkillSelfImproveService.name);

  constructor(
    private readonly skillService: SkillService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
  ) {}

  /**
   * Improve skills based on learned lessons from background review.
   * Called from BackgroundReviewService after extracting lessons.
   */
  async improveSkillsFromLessons(
    lessons: Array<{
      type: 'correction' | 'preference' | 'business_fact';
      content: string;
      workspaceId?: string;
      domain?: string;
      importance: number;
    }>,
  ): Promise<void> {
    for (const lesson of lessons) {
      if (lesson.importance < 7) {
        // Only improve skills for high-importance lessons
        continue;
      }

      try {
        await this.improveSkillForLesson(lesson);
      } catch (err: any) {
        this.logger.warn(
          `Skill self-improve failed for lesson: ${err.message}`,
        );
      }
    }
  }

  /**
   * Find relevant skill for a lesson and update it.
   */
  private async improveSkillForLesson(lesson: {
    type: 'correction' | 'preference' | 'business_fact';
    content: string;
    workspaceId?: string;
    domain?: string;
    importance: number;
  }): Promise<void> {
    // Find skills relevant to this lesson
    const skills = await this.skillService.findRelevant(
      lesson.domain,
      lesson.workspaceId,
    );

    if (skills.length === 0) {
      this.logger.debug(
        `No relevant skills for lesson: ${lesson.content.substring(0, 50)}`,
      );
      return;
    }

    // For now, pick the most used skill in the domain
    const skill = skills[0];

    // Generate improved skill content using LLM
    const improvedContent = await this.generateImprovedSkill(skill, lesson);

    if (improvedContent && improvedContent !== skill.content) {
      // Update skill with new content (version bumps automatically in service)
      await this.skillService.updateSkill(skill.id, {
        content: improvedContent,
        description: this.generateUpdatedDescription(skill.description, lesson),
      });

      this.logger.log(
        `Auto-improved skill: ${skill.name} (v${skill.version} -> new version)`,
      );
    }
  }

  /**
   * Use LLM to generate improved skill content incorporating the lesson.
   */
  private async generateImprovedSkill(
    skill: any,
    lesson: {
      type: 'correction' | 'preference' | 'business_fact';
      content: string;
      importance: number;
    },
  ): Promise<string | null> {
    const prompt = `You are improving a skill definition based on a new lesson learned.

CURRENT SKILL:
Name: ${skill.displayName}
Description: ${skill.description}
Content:
${skill.content}

NEW LESSON (importance: ${lesson.importance}/10):
Type: ${lesson.type}
Content: ${lesson.content}

TASK: Update the skill content to incorporate this lesson. Keep the same structure and style.
Only modify what's necessary. If the lesson doesn't apply, return the original content unchanged.

Return ONLY the updated skill content in markdown. No explanation.`;

    try {
      const response = await this.aiService.chat([
        { role: 'system', content: prompt },
        { role: 'user', content: 'Update the skill.' },
      ]);

      return response.content?.trim() || null;
    } catch (err: any) {
      this.logger.warn(`LLM skill improvement failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Generate updated description reflecting the lesson.
   */
  private generateUpdatedDescription(
    original: string,
    lesson: { type: string; content: string },
  ): string {
    const lessonSummary = lesson.content.substring(0, 80);
    return `${original} [Auto-updated: ${lesson.type} — ${lessonSummary}]`;
  }

  /**
   * Track skill usage when a tool is executed.
   * Called from ToolRegistryService after successful execution.
   */
  async trackSkillUsage(skillName: string): Promise<void> {
    const skill = await this.skillService.findByName(skillName);
    if (skill) {
      await this.skillService.incrementUsage(skill.id);
    }
  }

  /**
   * Get skill improvement history (version + source info).
   */
  async getSkillHistory(skillId: string): Promise<any[]> {
    // For now, return the current skill with version info
    // Future: add a SkillVersion table for full history
    const skill = await this.skillService.findById(skillId);
    if (!skill) return [];

    return [
      {
        version: skill.version,
        updatedAt: skill.updatedAt,
        sourceType: skill.sourceType,
        sourceInfo: skill.sourceInfo,
      },
    ];
  }
}
