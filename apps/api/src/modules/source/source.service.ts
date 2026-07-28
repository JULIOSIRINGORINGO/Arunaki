import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Source } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { SourceRepository } from './source.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class SourceService extends BaseService<Source> {
  constructor(
    protected readonly repository: SourceRepository,
    private readonly prisma: PrismaService,
  ) {
    super(repository);
  }

  async create(data: {
    workspaceId: string;
    name: string;
    type: string;
    path?: string;
  }): Promise<Source> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: data.workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace with id ${data.workspaceId} not found`);
    }
    return this.repository.create({
      workspaceId: data.workspaceId,
      name: data.name,
      type: data.type,
      path: data.path,
      status: 'pending',
    });
  }

  async findByWorkspaceId(workspaceId: string): Promise<Source[]> {
    return this.repository.findByWorkspaceId(workspaceId);
  }

  async updateStatus(
    id: string,
    status: string,
    fileCount?: number,
  ): Promise<Source> {
    const updateData: any = { status };
    if (fileCount !== undefined) {
      updateData.fileCount = fileCount;
    }
    return this.repository.update(id, updateData);
  }
}
