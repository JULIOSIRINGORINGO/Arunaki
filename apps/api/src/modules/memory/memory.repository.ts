import { Injectable, Inject } from '@nestjs/common';
import { Memory } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class MemoryRepository extends PrismaBaseRepository<Memory> {
  protected readonly model: any;

  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.memory;
  }

  async findActive(): Promise<Memory[]> {
    return this.prisma.memory.findMany({
      where: { active: true },
      orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
    });
  }

  async findByType(type: string): Promise<Memory[]> {
    return this.prisma.memory.findMany({
      where: { type, active: true },
      orderBy: { importance: 'desc' },
    });
  }

  async findByKey(type: string, key: string): Promise<Memory | null> {
    return this.prisma.memory.findUnique({
      where: { type_key: { type, key } },
    });
  }

  async findForWorkspace(workspaceId: string): Promise<Memory[]> {
    return this.prisma.memory.findMany({
      where: {
        active: true,
        OR: [
          { workspaceId: null }, // Global memories
          { workspaceId }, // Workspace-specific memories
        ],
      },
      orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
    });
  }

  /**
   * Find memories relevant to a domain and/or workspace.
   * Used for frozen snapshot injection into system prompt.
   */
  async findRelevant(
    domain?: string,
    workspaceId?: string,
    limit = 20,
  ): Promise<Memory[]> {
    const where: any = {
      active: true,
      OR: [
        // Domain-specific global memories
        { domain: domain || 'generic', workspaceId: null },
        // Generic global memories (always relevant)
        { domain: 'generic', workspaceId: null },
        // Workspace-scoped memories
        ...(workspaceId ? [{ workspaceId }] : []),
      ],
    };

    return this.prisma.memory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
      take: limit,
    });
  }

  async incrementAccess(id: string): Promise<void> {
    await this.prisma.memory.update({
      where: { id },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date(),
      },
    });
  }

  /**
   * Check for duplicate content before inserting.
   * Returns existing memory if duplicate found, null otherwise.
   */
  async findDuplicate(content: string, type?: string): Promise<Memory | null> {
    const where: any = {
      active: true,
      content: content.trim(),
    };
    if (type) {
      where.type = type;
    }

    return this.prisma.memory.findFirst({ where });
  }

  async upsert(data: {
    type: string;
    key: string;
    content: string;
    source?: string;
    importance?: number;
    domain?: string;
    workspaceId?: string;
    sessionId?: string;
  }): Promise<Memory> {
    return this.prisma.memory.upsert({
      where: { type_key: { type: data.type, key: data.key } },
      update: {
        content: data.content,
        source: data.source || 'auto',
        importance: data.importance || 5,
        domain: data.domain || 'generic',
        workspaceId: data.workspaceId,
        sessionId: data.sessionId,
      },
      create: {
        type: data.type,
        key: data.key,
        content: data.content,
        source: data.source || 'auto',
        importance: data.importance || 5,
        domain: data.domain || 'generic',
        workspaceId: data.workspaceId,
        sessionId: data.sessionId,
      },
    });
  }

  async search(query: string): Promise<Memory[]> {
    const lowerQuery = query.toLowerCase();
    return this.prisma.memory.findMany({
      where: {
        active: true,
        OR: [
          { key: { contains: lowerQuery } },
          { content: { contains: lowerQuery } },
        ],
      },
      orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
    });
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.memory.deleteMany({
      where: {
        active: false,
        expiresAt: { lt: now },
      },
    });
    return result.count;
  }
}
