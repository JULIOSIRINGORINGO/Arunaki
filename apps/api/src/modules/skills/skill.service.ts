import { Injectable, Logger } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { SkillRepository } from './skill.repository.js';

@Injectable()
export class SkillService extends BaseService<Skill> {
  private readonly logger = new Logger(SkillService.name);

  constructor(protected readonly repository: SkillRepository) {
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
  async getSkillsContext(domain?: string, workspaceId?: string, maxChars = 5000): Promise<string> {
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
      throw new Error(`Skill "${data.name}" already exists`);
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
    } as any);
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
  async seedStarterSkills(domain: string, skills: Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    content: string;
    tags: string[];
  }>): Promise<number> {
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
        this.logger.warn(`Failed to seed skill "${skill.name}": ${err.message}`);
      }
    }

    if (seeded > 0) {
      this.logger.log(`Seeded ${seeded} starter skills for domain: ${domain}`);
    }

    return seeded;
  }
}
