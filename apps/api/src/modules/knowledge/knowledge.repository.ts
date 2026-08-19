import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Knowledge, KnowledgeEdge } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class KnowledgeRepository extends PrismaBaseRepository<Knowledge> implements OnModuleInit {
  protected readonly model: any;

  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.knowledge;
  }

  async onModuleInit() {
    try {
      const existing = await this.prisma.knowledge.findUnique({
        where: { id: 'main-ai-node' }
      });
      if (!existing) {
        await this.prisma.knowledge.create({
          data: {
            id: 'main-ai-node',
            title: 'Arunaki AI',
            content: 'Sistem inti AI yang memproses semua knowledge.',
            type: 'core',
            active: true,
            nodeColor: '#10b981',
            icon: 'bot',
          }
        });
      }
    } catch (error) {
      console.error('Failed to seed main-ai-node:', error);
    }
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

  // ─── Graph-aware active context for AI (Strictly reachable from main-ai-node) ──
  async findActiveWithEdges(): Promise<{ nodes: Knowledge[]; edges: KnowledgeEdge[] }> {
    const [allNodes, allEdges] = await Promise.all([
      this.prisma.knowledge.findMany({
        where: { active: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.knowledgeEdge.findMany(),
    ]);

    const activeIds = new Set(allNodes.map((n) => n.id));

    // Valid active edges where both source and target are active nodes
    const activeEdges = allEdges.filter(
      (e) => activeIds.has(e.sourceId) && activeIds.has(e.targetId),
    );

    // Build undirected adjacency graph
    const adj = new Map<string, string[]>();
    for (const edge of activeEdges) {
      if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, []);
      if (!adj.has(edge.targetId)) adj.set(edge.targetId, []);
      adj.get(edge.sourceId)!.push(edge.targetId);
      adj.get(edge.targetId)!.push(edge.sourceId);
    }

    // BFS Traversal starting strictly from main-ai-node
    const reachableIds = new Set<string>();
    const startNodeId = 'main-ai-node';

    if (activeIds.has(startNodeId)) {
      reachableIds.add(startNodeId);
      const queue: string[] = [startNodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = adj.get(current) || [];
        for (const neighbor of neighbors) {
          if (!reachableIds.has(neighbor)) {
            reachableIds.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    // Filter nodes and edges strictly to those connected to Arunaki AI
    const reachableNodes = allNodes.filter((n) => reachableIds.has(n.id));
    const reachableEdges = activeEdges.filter(
      (e) => reachableIds.has(e.sourceId) && reachableIds.has(e.targetId),
    );

    return { nodes: reachableNodes, edges: reachableEdges };
  }
}
