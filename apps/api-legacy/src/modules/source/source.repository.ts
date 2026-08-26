import { Injectable, Inject } from '@nestjs/common';
import { Source } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class SourceRepository extends PrismaBaseRepository<Source> {
  protected readonly model;

  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.source;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Source[]> {
    return this.model.findMany({ where: { workspaceId } });
  }
}
