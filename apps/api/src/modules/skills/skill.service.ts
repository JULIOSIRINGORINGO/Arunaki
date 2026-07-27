import { Injectable } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { SkillRepository } from './skill.repository.js';

@Injectable()
export class SkillService extends BaseService<Skill> {
  constructor(protected readonly repository: SkillRepository) {
    super(repository);
  }

  async findActive(): Promise<Skill[]> {
    return this.repository.findActive();
  }

  async findByCategory(category: string): Promise<Skill[]> {
    return this.repository.findByCategory(category);
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

  async getSkillsContext(): Promise<string> {
    const skills = await this.findActive();
    if (skills.length === 0) return '';

    return skills
      .map(
        (s) =>
          `## ${s.displayName} (${s.name})\n${s.description}\nKategori: ${s.category} | Digunakan: ${s.usageCount}x`,
      )
      .join('\n\n');
  }

  async createSkill(data: {
    name: string;
    displayName: string;
    description: string;
    category?: string;
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
    return this.update(id, updateData);
  }
}