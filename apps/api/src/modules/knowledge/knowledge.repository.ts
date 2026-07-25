import { Injectable } from '@nestjs/common';
import { Knowledge } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class KnowledgeRepository extends PrismaBaseRepository<Knowledge> {
  protected readonly model: any;

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.knowledge;
  }

  async findActive(): Promise<Knowledge[]> {
    return this.prisma.knowledge.findMany({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async toggleActive(id: string): Promise<Knowledge> {
    const item = await this.prisma.knowledge.findUnique({ where: { id } });
    return this.prisma.knowledge.update({
      where: { id },
      data: { active: !item?.active },
    });
  }
}
