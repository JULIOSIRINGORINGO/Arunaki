import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/providers/prisma.service.js';
import {
  Artifact,
  ArtifactStatus,
  ArtifactFilter,
  CreateArtifactInput,
} from './interfaces/artifact.interface.js';

@Injectable()
export class ArtifactStore implements OnModuleInit {
  private readonly logger = new Logger(ArtifactStore.name);
  private readonly artifacts = new Map<string, Artifact>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const dbArtifacts = await this.prisma.artifact.findMany();
      for (const a of dbArtifacts) {
        let meta: any = {};
        let data: any = {};
        try {
          meta = JSON.parse(a.metadata || '{}');
        } catch {}
        try {
          data = JSON.parse(a.sourceFiles || '{}');
        } catch {}

        const item: Artifact = {
          id: a.id,
          type: (a.type as any) || 'document',
          filename: a.name,
          mimeType: meta.mimeType || 'application/octet-stream',
          contentBase64: meta.contentBase64,
          preview: a.preview || '',
          data,
          metadata: {
            createdBy: meta.createdBy || 'agent',
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            version: meta.version || 1,
            lineage: meta.lineage || [],
            tags: meta.tags || [],
          },
          status: (meta.status as ArtifactStatus) || 'draft',
        };
        this.artifacts.set(item.id, item);
      }
      this.logger.log(`ArtifactStore initialized with ${this.artifacts.size} persistent artifacts from DB.`);
    } catch (e) {
      this.logger.warn(`Could not load persistent artifacts from DB: ${e.message}`);
    }
  }

  create(input: CreateArtifactInput): Artifact {
    // Unpredictable UUID Generation to prevent IDOR guessing
    const uuid = crypto.randomUUID();
    const id = `art_${uuid}`;
    const now = new Date();

    const artifact: Artifact = {
      id,
      type: input.type,
      filename: input.filename,
      mimeType: input.mimeType,
      contentBase64: input.contentBase64,
      preview: input.preview,
      data: input.data || {},
      metadata: {
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lineage: input.lineage || [],
        tags: input.tags || [],
      },
      status: 'draft',
    };

    this.artifacts.set(id, artifact);
    this.logger.log(`Artifact created with secure UUID: ${id} (${input.type})`);

    // Async DB Persistence
    this.persistToDb(artifact).catch((err) =>
      this.logger.error(`Failed to persist artifact ${id} to DB: ${err.message}`),
    );

    return artifact;
  }

  private async persistToDb(artifact: Artifact) {
    const metaJson = JSON.stringify({
      createdBy: artifact.metadata.createdBy,
      mimeType: artifact.mimeType,
      contentBase64: artifact.contentBase64,
      version: artifact.metadata.version,
      lineage: artifact.metadata.lineage,
      tags: artifact.metadata.tags,
      status: artifact.status,
    });

    const workspaceTag = artifact.metadata.tags.find((t) => t.startsWith('workspace:'));
    const workspaceId = workspaceTag ? workspaceTag.replace('workspace:', '') : null;

    await this.prisma.artifact.upsert({
      where: { id: artifact.id },
      create: {
        id: artifact.id,
        workspace: workspaceId ? { connect: { id: workspaceId } } : undefined,
        name: artifact.filename,
        type: artifact.type,
        format: artifact.filename.split('.').pop() || 'bin',
        metadata: metaJson,
        preview: artifact.preview,
        sourceFiles: JSON.stringify(artifact.data),
        createdAt: artifact.metadata.createdAt,
        updatedAt: artifact.metadata.updatedAt,
      },
      update: {
        metadata: metaJson,
        preview: artifact.preview,
        updatedAt: artifact.metadata.updatedAt,
      },
    });
  }

  findById(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  find(filter: ArtifactFilter): Artifact[] {
    let results = Array.from(this.artifacts.values());

    if (filter.type) {
      results = results.filter((a) => a.type === filter.type);
    }
    if (filter.status) {
      results = results.filter((a) => a.status === filter.status);
    }
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((a) =>
        filter.tags!.some((tag: string) => a.metadata.tags.includes(tag)),
      );
    }
    if (filter.createdBy) {
      results = results.filter(
        (a) => a.metadata.createdBy === filter.createdBy,
      );
    }
    if (filter.createdAfter) {
      results = results.filter(
        (a) => a.metadata.createdAt >= filter.createdAfter!,
      );
    }
    if (filter.createdBefore) {
      results = results.filter(
        (a) => a.metadata.createdAt <= filter.createdBefore!,
      );
    }

    return results.sort(
      (a, b) =>
        b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime(),
    );
  }

  updateStatus(id: string, status: ArtifactStatus): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    if (!artifact) return undefined;

    artifact.status = status;
    artifact.metadata.updatedAt = new Date();
    this.persistToDb(artifact).catch(() => {});
    return artifact;
  }

  addTag(id: string, tag: string): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    if (!artifact) return undefined;

    if (!artifact.metadata.tags.includes(tag)) {
      artifact.metadata.tags.push(tag);
      artifact.metadata.updatedAt = new Date();
      this.persistToDb(artifact).catch(() => {});
    }
    return artifact;
  }

  removeTag(id: string, tag: string): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    if (!artifact) return undefined;

    artifact.metadata.tags = artifact.metadata.tags.filter((t: string) => t !== tag);
    artifact.metadata.updatedAt = new Date();
    this.persistToDb(artifact).catch(() => {});
    return artifact;
  }

  delete(id: string): boolean {
    const deleted = this.artifacts.delete(id);
    if (deleted) {
      this.prisma.artifact.delete({ where: { id } }).catch(() => {});
    }
    return deleted;
  }

  count(): number {
    return this.artifacts.size;
  }

  getRecent(limit: number = 10): Artifact[] {
    return Array.from(this.artifacts.values())
      .sort(
        (a, b) =>
          b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime(),
      )
      .slice(0, limit);
  }
}
