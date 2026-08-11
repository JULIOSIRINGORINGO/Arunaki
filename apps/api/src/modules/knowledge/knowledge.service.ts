import { Injectable } from '@nestjs/common';
import { Knowledge, KnowledgeEdge } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { KnowledgeRepository } from './knowledge.repository.js';

@Injectable()
export class KnowledgeService extends BaseService<Knowledge> {
  constructor(protected readonly repository: KnowledgeRepository) {
    super(repository);
  }

  async findActive(): Promise<Knowledge[]> {
    return this.repository.findActive();
  }

  async toggleActive(id: string): Promise<Knowledge> {
    return this.repository.toggleActive(id);
  }

  // ─── Canvas position ─────────────────────────────────
  async updatePosition(id: string, positionX: number, positionY: number): Promise<Knowledge> {
    return this.repository.updatePosition(id, positionX, positionY);
  }

  async updatePositions(positions: Array<{ id: string; positionX: number; positionY: number }>): Promise<void> {
    return this.repository.updatePositions(positions);
  }

  // ─── Edge / Connection CRUD ───────────────────────────
  async findAllEdges(): Promise<KnowledgeEdge[]> {
    return this.repository.findAllEdges();
  }

  async createEdge(sourceId: string, targetId: string, label?: string): Promise<KnowledgeEdge> {
    return this.repository.createEdge(sourceId, targetId, label);
  }

  async deleteEdge(id: string): Promise<KnowledgeEdge> {
    return this.repository.deleteEdge(id);
  }

  // ─── AI Context (RAG & Map) ─────────────────────────
  async getKnowledgeMap(): Promise<string> {
    const { nodes, edges } = await this.repository.findActiveWithEdges();
    if (nodes.length === 0) return 'Knowledge Graph is empty.';

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const connections = new Map<string, string[]>();

    for (const edge of edges) {
      const sourceTitle = nodeMap.get(edge.sourceId)?.title;
      const targetTitle = nodeMap.get(edge.targetId)?.title;
      if (sourceTitle && targetTitle) {
        if (!connections.has(edge.sourceId)) connections.set(edge.sourceId, []);
        connections.get(edge.sourceId)!.push(targetTitle + (edge.label ? ` (${edge.label})` : ''));

        if (!connections.has(edge.targetId)) connections.set(edge.targetId, []);
        connections.get(edge.targetId)!.push(sourceTitle + (edge.label ? ` (${edge.label})` : ''));
      }
    }

    return nodes
      .map((k) => {
        const conn = connections.get(k.id);
        const connStr = conn && conn.length > 0 ? ` (Connected to: ${conn.join(', ')})` : '';
        return `- ${k.title} [Type: ${k.type}]${connStr}`;
      })
      .join('\n');
  }

  async searchNodes(query: string): Promise<string> {
    const { nodes, edges } = await this.repository.findActiveWithEdges();
    if (nodes.length === 0) return 'No data found.';

    const q = query.toLowerCase();
    const targetNode = nodes.find(n => n.title.toLowerCase().includes(q) || n.type.toLowerCase().includes(q));
    
    if (!targetNode) return 'Node not found in the Knowledge Graph.';

    // Find directly connected nodes
    const connectedIds = new Set<string>();
    connectedIds.add(targetNode.id);
    
    for (const edge of edges) {
      if (edge.sourceId === targetNode.id) connectedIds.add(edge.targetId);
      if (edge.targetId === targetNode.id) connectedIds.add(edge.sourceId);
    }

    const connectedNodes = nodes.filter(n => connectedIds.has(n.id));

    return connectedNodes
      .map(k => {
        return `--- ${k.title} [${k.type}] ---\n${k.content}`;
      })
      .join('\n\n');
  }
}
