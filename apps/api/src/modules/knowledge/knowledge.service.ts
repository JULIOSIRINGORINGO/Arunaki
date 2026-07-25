import { Injectable } from '@nestjs/common';
import { Knowledge } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { KnowledgeRepository } from './knowledge.repository.js';

@Injectable()
export class KnowledgeService extends BaseService<Knowledge> {
  constructor(protected readonly repository: KnowledgeRepository) {
    super(repository);
  }

  async findActive(): Promise<Knowledge[]> {
    return this.repository.findActive();
  }

  async toggleActive(id: string): Promise<Knowledge> {
    return this.repository.toggleActive(id);
  }

  async getActiveContext(): Promise<string> {
    const activeKnowledge = await this.findActive();
    if (activeKnowledge.length === 0) return '';

    return activeKnowledge
      .map((k) => `--- ${k.title} ---\n${k.content}`)
      .join('\n\n');
  }
}
