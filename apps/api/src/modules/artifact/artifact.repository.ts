import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/providers/prisma.service';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository';
import { Artifact } from '@prisma/client';

@Injectable()
export class ArtifactRepository extends PrismaBaseRepository<Artifact> {
  protected get model() {
    return this.prisma.artifact;
  }

  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async findAllArtifacts(): Promise<Artifact[]> {
    return this.model.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByWorkspaceId(workspaceId: string): Promise<Artifact[]> {
    return this.model.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByWorkspaceAndType(
    workspaceId: string,
    type: string,
  ): Promise<Artifact[]> {
    return this.model.findMany({
      where: { workspaceId, type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByTag(tag: string): Promise<Artifact[]> {
    return this.model.findMany({
      where: {
        metadata: {
          contains: tag,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
