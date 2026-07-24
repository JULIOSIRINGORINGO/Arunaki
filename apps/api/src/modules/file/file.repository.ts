import { Injectable } from '@nestjs/common';
import { File } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class FileRepository extends PrismaBaseRepository<File> {
  protected readonly model: any;

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.file;
  }

  async findBySourceId(sourceId: string): Promise<File[]> {
    return this.model.findMany({
      where: { sourceId },
      orderBy: { name: 'asc' },
    });
  }

  async findByWorkspaceId(workspaceId: string): Promise<File[]> {
    return this.model.findMany({
      where: { source: { workspaceId } },
      orderBy: { name: 'asc' },
    });
  }

  async findByStatus(status: string): Promise<File[]> {
    return this.model.findMany({
      where: { status },
    });
  }
}
