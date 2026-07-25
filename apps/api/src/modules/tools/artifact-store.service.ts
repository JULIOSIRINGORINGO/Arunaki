import { Injectable, Logger } from '@nestjs/common';
import {
  Artifact,
  ArtifactType,
  ArtifactStatus,
  ArtifactFilter,
  CreateArtifactInput,
} from './interfaces/artifact.interface.js';

@Injectable()
export class ArtifactStore {
  private readonly logger = new Logger(ArtifactStore.name);
  private readonly artifacts = new Map<string, Artifact>();
  private counter = 0;

  create(input: CreateArtifactInput): Artifact {
    this.counter++;
    const id = `artifact-${Date.now()}-${this.counter}`;
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
    this.logger.log(`Artifact created: ${id} (${input.type})`);
    return artifact;
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
    return artifact;
  }

  addTag(id: string, tag: string): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    if (!artifact) return undefined;

    if (!artifact.metadata.tags.includes(tag)) {
      artifact.metadata.tags.push(tag);
      artifact.metadata.updatedAt = new Date();
    }
    return artifact;
  }

  removeTag(id: string, tag: string): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    if (!artifact) return undefined;

    artifact.metadata.tags = artifact.metadata.tags.filter((t: string) => t !== tag);
    artifact.metadata.updatedAt = new Date();
    return artifact;
  }

  delete(id: string): boolean {
    return this.artifacts.delete(id);
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
