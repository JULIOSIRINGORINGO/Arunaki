import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Source } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { SourceRepository } from './source.repository.js';
import { WorkspaceService } from '../workspace/workspace.service.js';

@Injectable()
export class SourceService extends BaseService<Source> {
  constructor(
    protected readonly repository: SourceRepository,
    private readonly workspaceService: WorkspaceService,
  ) {
    super(repository);
  }

  async create(data: { workspaceId: string; name: string; type: string; path?: string }): Promise<Source> {
    await this.workspaceService.findById(data.workspaceId);
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

  async updateStatus(id: string, status: string, fileCount?: number): Promise<Source> {
    const updateData: any = { status };
    if (fileCount !== undefined) {
      updateData.fileCount = fileCount;
    }
    return this.repository.update(id, updateData);
  }
}
