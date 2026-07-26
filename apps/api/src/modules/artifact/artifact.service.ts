import { Injectable, NotFoundException } from '@nestjs/common';
import { ArtifactRepository } from './artifact.repository';
import { Artifact } from '@prisma/client';

@Injectable()
export class ArtifactService {
  constructor(private readonly artifactRepo: ArtifactRepository) {}

  async create(data: {
    workspaceId?: string;
    name: string;
    type: string;
    format?: string;
    path?: string;
    metadata?: any;
    sourceFiles?: any;
  }): Promise<Artifact> {
    const metaJson = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {});
    const sourceFilesJson = typeof data.sourceFiles === 'string' ? data.sourceFiles : JSON.stringify(data.sourceFiles || []);

    return this.artifactRepo.create({
      workspaceId: data.workspaceId || undefined,
      name: data.name,
      type: data.type,
      format: data.format || 'md',
      path: data.path || '',
      metadata: metaJson,
      sourceFiles: sourceFilesJson,
    });
  }

  async createFromAgent(input: {
    workspaceId?: string;
    name: string;
    type: string;
    format?: string;
    mimeType?: string;
    contentBase64?: string;
    preview?: string;
    data?: any;
    createdBy: string;
    tags?: string[];
    lineage?: string[];
  }): Promise<Artifact> {
    const metadata = {
      createdBy: input.createdBy,
      mimeType: input.mimeType || 'application/octet-stream',
      contentBase64: input.contentBase64,
      version: 1,
      lineage: input.lineage || [],
      tags: input.tags || [],
    };

    return this.create({
      workspaceId: input.workspaceId,
      name: input.name,
      type: input.type,
      format: input.format || input.name.split('.').pop() || 'bin',
      path: '',
      metadata,
      sourceFiles: input.data || [],
    });
  }

  async findAllArtifacts(): Promise<Artifact[]> {
    return this.artifactRepo.findAllArtifacts();
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

  async findByWorkspaceAndType(
    workspaceId: string,
    type: string,
  ): Promise<Artifact[]> {
    return this.artifactRepo.findByWorkspaceAndType(workspaceId, type);
  }

  async findByTag(tag: string): Promise<Artifact[]> {
    return this.artifactRepo.findByTag(tag);
  }

  async update(
    id: string,
    data: { name?: string; metadata?: any },
  ): Promise<Artifact> {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.metadata) updateData.metadata = JSON.stringify(data.metadata);
    return this.artifactRepo.update(id, updateData);
  }

  async delete(id: string): Promise<void> {
    await this.artifactRepo.delete(id);
  }

  parseMetadata(artifact: Artifact): any {
    try {
      return JSON.parse(artifact.metadata || '{}');
    } catch {
      return {};
    }
  }
}
