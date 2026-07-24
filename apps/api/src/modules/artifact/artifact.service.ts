import { Injectable, NotFoundException } from '@nestjs/common';
import { ArtifactRepository } from './artifact.repository';
import { Artifact } from '@prisma/client';

@Injectable()
export class ArtifactService {
  constructor(private readonly artifactRepo: ArtifactRepository) {}

  async create(data: { workspaceId: string; name: string; type: string; format?: string; path?: string; metadata?: any }): Promise<Artifact> {
    return this.artifactRepo.create({
      workspaceId: data.workspaceId,
      name: data.name,
      type: data.type,
      format: data.format || 'md',
      path: data.path || '',
      metadata: JSON.stringify(data.metadata || {}),
      sourceFiles: '[]',
    });
  }

  async findById(id: string): Promise<Artifact> {
    const artifact = await this.artifactRepo.findById(id);
    if (!artifact) {
      throw new NotFoundException(`Artifact ${id} not found`);
    }
    return artifact;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Artifact[]> {
    return this.artifactRepo.findByWorkspaceId(workspaceId);
  }

  async findByWorkspaceAndType(workspaceId: string, type: string): Promise<Artifact[]> {
    return this.artifactRepo.findByWorkspaceAndType(workspaceId, type);
  }

  async update(id: string, data: { name?: string; metadata?: any }): Promise<Artifact> {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.metadata) updateData.metadata = JSON.stringify(data.metadata);
    return this.artifactRepo.update(id, updateData);
  }

  async delete(id: string): Promise<void> {
    await this.artifactRepo.delete(id);
  }
}
