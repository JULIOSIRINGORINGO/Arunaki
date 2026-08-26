import { Injectable, Inject } from '@nestjs/common';
import { Workspace } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class WorkspaceRepository extends PrismaBaseRepository<Workspace> {
  protected readonly model;

  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.workspace;
  }
}
