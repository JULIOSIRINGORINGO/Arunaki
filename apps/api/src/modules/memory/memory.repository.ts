import { Injectable } from '@nestjs/common';
import { Memory } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class MemoryRepository extends PrismaBaseRepository<Memory> {
  protected readonly model: any;

  constructor(protected readonly prisma: PrismaService) {
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
          { workspaceId },      // Workspace-specific memories
        ],
      },
      orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
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

  async upsert(data: {
    type: string;
    key: string;
    content: string;
    source?: string;
    importance?: number;
    workspaceId?: string;
    sessionId?: string;
  }): Promise<Memory> {
    return this.prisma.memory.upsert({
      where: { type_key: { type: data.type, key: data.key } },
      update: {
        content: data.content,
        source: data.source || 'auto',
        importance: data.importance || 5,
        workspaceId: data.workspaceId,
        sessionId: data.sessionId,
      },
      create: {
        type: data.type,
        key: data.key,
        content: data.content,
        source: data.source || 'auto',
        importance: data.importance || 5,
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