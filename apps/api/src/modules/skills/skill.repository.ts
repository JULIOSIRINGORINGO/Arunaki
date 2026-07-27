import { Injectable } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class SkillRepository extends PrismaBaseRepository<Skill> {
  protected readonly model: any;

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.skill;
  }

  async findActive(): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      where: { active: true },
      orderBy: { usageCount: 'desc' },
    });
  }

  /**
   * Find skills relevant to a domain and/or workspace.
   * Returns global skills + workspace-scoped skills, filtered by domain.
   */
  async findRelevant(domain?: string, workspaceId?: string): Promise<Skill[]> {
    const where: any = {
      active: true,
      OR: [
        // Global skills matching domain
        { domain: domain || 'generic', workspaceId: null },
        // Global generic skills (always available)
        { domain: 'generic', workspaceId: null },
        // Workspace-scoped skills
        ...(workspaceId ? [{ workspaceId }] : []),
      ],
    };

    return this.prisma.skill.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { usageCount: 'desc' }],
    });
  }

  async findByCategory(category: string): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      where: { category, active: true },
      orderBy: { usageCount: 'desc' },
    });
  }

  async findByDomain(domain: string): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      where: { domain, active: true },
      orderBy: { usageCount: 'desc' },
    });
  }

  async findByWorkspace(workspaceId: string): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      where: { workspaceId, active: true },
      orderBy: { usageCount: 'desc' },
    });
  }

  async findByName(name: string): Promise<Skill | null> {
    return this.prisma.skill.findUnique({ where: { name } });
  }

  async incrementUsage(id: string): Promise<void> {
    await this.prisma.skill.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }

  async search(query: string): Promise<Skill[]> {
    const lowerQuery = query.toLowerCase();
    return this.prisma.skill.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: lowerQuery } },
          { displayName: { contains: lowerQuery } },
          { description: { contains: lowerQuery } },
          { tags: { contains: lowerQuery } },
        ],
      },
      orderBy: { usageCount: 'desc' },
    });
  }
}
