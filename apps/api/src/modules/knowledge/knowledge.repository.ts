import { Injectable, Inject } from '@nestjs/common';
import { Knowledge, KnowledgeEdge } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class KnowledgeRepository extends PrismaBaseRepository<Knowledge> {
  protected readonly model: any;

  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.knowledge;
  }

  async findActive(): Promise<Knowledge[]> {
    return this.prisma.knowledge.findMany({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findByTitle(title: string): Promise<Knowledge | null> {
    return this.prisma.knowledge.findFirst({
      where: { title },
    });
  }

  async toggleActive(id: string): Promise<Knowledge> {
    const item = await this.prisma.knowledge.findUnique({ where: { id } });
    return this.prisma.knowledge.update({
      where: { id },
      data: { active: !item?.active },
    });
  }

  // ─── Canvas position ─────────────────────────────────
  async updatePosition(id: string, positionX: number, positionY: number): Promise<Knowledge> {
    return this.prisma.knowledge.update({
      where: { id },
      data: { positionX, positionY },
    });
  }

  async updatePositions(positions: Array<{ id: string; positionX: number; positionY: number }>): Promise<void> {
    await this.prisma.$transaction(
      positions.map((p) =>
        this.prisma.knowledge.update({
          where: { id: p.id },
          data: { positionX: p.positionX, positionY: p.positionY },
        }),
      ),
    );
  }

  // ─── Edge / Connection CRUD ───────────────────────────
  async findAllEdges(): Promise<KnowledgeEdge[]> {
    return this.prisma.knowledgeEdge.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEdge(sourceId: string, targetId: string, label?: string): Promise<KnowledgeEdge> {
    return this.prisma.knowledgeEdge.create({
      data: { sourceId, targetId, label },
    });
  }

  async deleteEdge(id: string): Promise<KnowledgeEdge> {
    return this.prisma.knowledgeEdge.delete({
      where: { id },
    });
  }

  async findEdgesByNodeId(nodeId: string): Promise<KnowledgeEdge[]> {
    return this.prisma.knowledgeEdge.findMany({
      where: {
        OR: [{ sourceId: nodeId }, { targetId: nodeId }],
      },
    });
  }

  // ─── Graph-aware active context for AI ────────────────
  async findActiveWithEdges(): Promise<{ nodes: Knowledge[]; edges: KnowledgeEdge[] }> {
    const [nodes, edges] = await Promise.all([
      this.prisma.knowledge.findMany({
        where: { active: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.knowledgeEdge.findMany(),
    ]);

    // Filter edges to only include active node connections
    const activeIds = new Set(nodes.map((n) => n.id));
    const activeEdges = edges.filter(
      (e) => activeIds.has(e.sourceId) && activeIds.has(e.targetId),
    );

    return { nodes, edges: activeEdges };
  }
}
