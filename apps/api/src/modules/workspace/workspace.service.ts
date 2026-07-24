import { Injectable, NotFoundException } from '@nestjs/common';
import { Workspace } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { WorkspaceRepository } from './workspace.repository.js';

@Injectable()
export class WorkspaceService extends BaseService<Workspace> {
  constructor(protected readonly repository: WorkspaceRepository) {
    super(repository);
  }

  async create(data: { name: string; description?: string }): Promise<Workspace> {
    return this.repository.create({
      name: data.name,
      description: data.description,
      status: 'pending',
    });
  }

  async findAll(): Promise<Workspace[]> {
    return this.repository.findAll({
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  async findById(id: string): Promise<Workspace> {
    const workspace = await super.findById(id);
    if (!workspace) {
      throw new NotFoundException(`Workspace with id ${id} not found`);
    }
    return workspace;
  }

  async updateStatus(id: string, status: string): Promise<Workspace> {
    return this.repository.update(id, { status });
  }
}
