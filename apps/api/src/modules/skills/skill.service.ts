import { Injectable, Logger } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { SkillRepository } from './skill.repository.js';
import { AiService } from '../ai/ai.service.js';

export interface SkillComposition {
  name: string;
  displayName: string;
  description: string;
  category: string;
  domain: string;
  content: string;
  tags: string[];
  sourceSkills: string[]; // names of skills composed
  version: string;
}

@Injectable()
export class SkillService extends BaseService<Skill> {
  private readonly logger = new Logger(SkillService.name);

  constructor(
    protected readonly repository: SkillRepository,
    private readonly aiService: AiService,
  ) {
    super(repository);
  }

  async findActive(): Promise<Skill[]> {
    return this.repository.findActive();
  }

  /**
   * Find skills relevant to a domain and/or workspace.
   * Used for auto-injection into system prompt.
   */
  async findRelevant(domain?: string, workspaceId?: string): Promise<Skill[]> {
    return this.repository.findRelevant(domain, workspaceId);
  }

  async findByCategory(category: string): Promise<Skill[]> {
    return this.repository.findByCategory(category);
  }

  async findByDomain(domain: string): Promise<Skill[]> {
    return this.repository.findByDomain(domain);
  }

  async findByWorkspace(workspaceId: string): Promise<Skill[]> {
    return this.repository.findByWorkspace(workspaceId);
  }

  async findByName(name: string): Promise<Skill | null> {
    return this.repository.findByName(name);
  }

  /**
   * Find a skill by name, preferring workspace-scoped over global.
   * Returns null if no skill with that name exists in the given workspace or globally.
   */
  async findByNameInWorkspace(
    name: string,
    workspaceId: string,
  ): Promise<Skill | null> {
    const skill = await this.repository.findByName(name);
    if (!skill) return null;
    // Return the skill if it belongs to this workspace or is global
    if (skill.workspaceId === null || skill.workspaceId === workspaceId) {
      return skill;
    }
    // Skill exists but belongs to another workspace — treat as not found
    return null;
  }

  async incrementUsage(id: string): Promise<void> {
    return this.repository.incrementUsage(id);
  }

  async search(query: string): Promise<Skill[]> {
    return this.repository.search(query);
  }

  /**
   * Get skills context for prompt injection.
   * Filters by domain and workspace, formats as markdown.
   * This is the AUTO-INJECTION method — called by workspace runner.
   */
  async getSkillsContext(
    domain?: string,
    workspaceId?: string,
    maxChars = 5000,
  ): Promise<string> {
    const skills = await this.findRelevant(domain, workspaceId);
    if (skills.length === 0) return '';

    const lines: string[] = [];

    for (const s of skills) {
      const skillBlock = `### ${s.displayName}\n${s.description}\n${s.content.substring(0, 300)}${s.content.length > 300 ? '...' : ''}`;

      // Check if adding this skill would exceed budget
      if (lines.join('\n\n').length + skillBlock.length > maxChars) {
        break;
      }

      lines.push(skillBlock);
    }

    this.logger.log(
      `Injected ${lines.length} skills (domain: ${domain || 'any'}, workspace: ${workspaceId || 'global'})`,
    );

    return lines.join('\n\n');
  }

  async createSkill(data: {
    name: string;
    displayName: string;
    description: string;
    category?: string;
    domain?: string;
    workspaceId?: string;
    content: string;
    tags?: string[];
    sourceType?: string;
    sourceInfo?: string;
  }): Promise<Skill> {
    const existing = await this.findByName(data.name);
    if (existing) {
      const owner = existing.workspaceId
        ? `workspace ${existing.workspaceId}`
        : 'global scope';
      throw new Error(
        `Skill "${data.name}" already exists (owned by ${owner}). Use a different name.`,
      );
    }

    return this.create({
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      category: data.category || 'general',
      domain: data.domain || 'generic',
      workspaceId: data.workspaceId || null,
      content: data.content,
      tags: JSON.stringify(data.tags || []),
      sourceType: data.sourceType || 'auto',
      sourceInfo: data.sourceInfo || null,
    });
  }

  async updateSkill(
    id: string,
    data: Partial<{
      displayName: string;
      description: string;
      category: string;
      domain: string;
      content: string;
      tags: string[];
      active: boolean;
      pinned: boolean;
    }>,
  ): Promise<Skill> {
    const updateData: any = { ...data };
    if (data.tags) {
      updateData.tags = JSON.stringify(data.tags);
    }

    // Increment version on content change
    if (data.content) {
      const existing = await this.findById(id);
      if (existing) {
        const parts = existing.version.split('.');
        updateData.version = `${parts[0]}.${parts[1]}.${parseInt(parts[2]) + 1}`;
      }
    }

    return this.update(id, updateData);
  }

  /**
   * Seed starter skills for a domain.
   * Skips if skill name already exists.
   */
  async seedStarterSkills(
    domain: string,
    skills: Array<{
      name: string;
      displayName: string;
      description: string;
      category: string;
      content: string;
      tags: string[];
    }>,
  ): Promise<number> {
    let seeded = 0;

    for (const skill of skills) {
      try {
        const existing = await this.findByName(skill.name);
        if (!existing) {
          await this.createSkill({
            ...skill,
            domain,
            sourceType: 'starter',
          });
          seeded++;
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to seed skill "${skill.name}": ${err.message}`,
        );
      }
    }

    if (seeded > 0) {
      this.logger.log(`Seeded ${seeded} starter skills for domain: ${domain}`);
    }

    return seeded;
  }

  /**
   * Get skill by name with full content (for runtime loading).
   * Returns null if not found.
   */
  async loadSkill(name: string): Promise<Skill | null> {
    return this.findByName(name);
  }

  /**
   * Load multiple skills by names — for dynamic skill loading at runtime.
   */
  async loadSkills(names: string[]): Promise<Skill[]> {
    const skills: Skill[] = [];
    for (const name of names) {
      const skill = await this.findByName(name);
      if (skill) skills.push(skill);
    }
    return skills;
  }

  /**
   * Compose multiple skills into a new composite skill.
   * Uses LLM to merge content intelligently.
   */
  async composeSkills(
    skillNames: string[],
    options: {
      name: string;
      displayName: string;
      description: string;
      category?: string;
      domain?: string;
      workspaceId?: string;
    },
  ): Promise<Skill> {
    const skills = await this.loadSkills(skillNames);
    if (skills.length < 2) {
      throw new Error('Need at least 2 skills to compose');
    }

    // Use LLM to intelligently merge skill content
    const mergedContent = await this.mergeSkillContent(
      skills,
      options.description,
    );

    return this.createSkill({
      ...options,
      content: mergedContent,
      tags: skills.flatMap((s) => JSON.parse(s.tags || '[]')),
      sourceType: 'composed',
      sourceInfo: JSON.stringify({
        composedFrom: skillNames,
        at: new Date().toISOString(),
      }),
    });
  }

  /**
   * Use LLM to merge skill content.
   */
  private async mergeSkillContent(
    skills: Skill[],
    targetDescription: string,
  ): Promise<string> {
    const skillBlocks = skills
      .map((s) => `## ${s.displayName}\n${s.content}`)
      .join('\n\n---\n\n');

    const messages = [
      {
        role: 'system' as const,
        content: `You are the Skill Consolidation Agent.
Your task: merge multiple skill blocks into a single clean skill block.

Source skills:
${skillBlocks}

Target description: ${targetDescription}

RULES:
- Merge content without duplication
- Maintain clear markdown structure
- Prioritize specific and actionable instructions
- Remove redundancy
- Output: ONLY the merged markdown content, no explanations`,
      },
      { role: 'user' as const, content: 'Merge the skills above.' },
    ];

    const response = await this.aiService.chat(messages, []);
    return response.content?.trim() || skillBlocks;
  }

  /**
   * Get version history for a skill.
   */
  async getSkillHistory(skillId: string): Promise<
    Array<{
      version: string;
      updatedAt: Date;
      sourceType: string;
      sourceInfo: string | null;
    }>
  > {
    const skill = await this.findById(skillId);
    if (!skill) return [];

    // For now, return current version info
    // Future: add SkillVersion table for full history
    return [
      {
        version: skill.version,
        updatedAt: skill.updatedAt,
        sourceType: skill.sourceType,
        sourceInfo: skill.sourceInfo,
      },
    ];
  }

  /**
   * Rollback skill to previous version (if history exists).
   * Currently placeholder — requires SkillVersion table.
   */
  // TODO: Implement skill version rollback. Requires a SkillVersion table
  // to store historical content snapshots. Currently only the version counter
  // is incremented on update; the old content is not preserved.
  async rollbackSkill(
    skillId: string,
    targetVersion: string,
  ): Promise<Skill | null> {
    this.logger.warn(
      `Rollback requested for ${skillId} to ${targetVersion} — not yet implemented (needs SkillVersion table)`,
    );
    return null;
  }
}
