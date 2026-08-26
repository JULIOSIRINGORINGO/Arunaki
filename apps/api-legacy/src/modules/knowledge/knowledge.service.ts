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
  async updatePosition(
    id: string,
    positionX: number,
    positionY: number,
  ): Promise<Knowledge> {
    return this.repository.updatePosition(id, positionX, positionY);
  }

  async updatePositions(
    positions: Array<{ id: string; positionX: number; positionY: number }>,
  ): Promise<void> {
    return this.repository.updatePositions(positions);
  }

  // ─── Edge / Connection CRUD ───────────────────────────
  async findAllEdges(): Promise<KnowledgeEdge[]> {
    return this.repository.findAllEdges();
  }

  async createEdge(
    sourceId: string,
    targetId: string,
    label?: string,
  ): Promise<KnowledgeEdge> {
    return this.repository.createEdge(sourceId, targetId, label);
  }

  async deleteEdge(id: string): Promise<KnowledgeEdge> {
    return this.repository.deleteEdge(id);
  }

  // ─── AI Context (RAG & Map) ─────────────────────────
  async getKnowledgeMap(): Promise<string> {
    const { nodes, edges } = await this.repository.findActiveWithEdges();
    // Exclude main-ai-node from knowledge document entries
    const docNodes = nodes.filter((n) => n.id !== 'main-ai-node');
    if (docNodes.length === 0) return 'No connected knowledge documents.';

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const connections = new Map<string, string[]>();

    for (const edge of edges) {
      const sourceTitle = nodeMap.get(edge.sourceId)?.title;
      const targetTitle = nodeMap.get(edge.targetId)?.title;
      if (sourceTitle && targetTitle) {
        if (!connections.has(edge.sourceId)) connections.set(edge.sourceId, []);
        connections
          .get(edge.sourceId)!
          .push(targetTitle + (edge.label ? ` (${edge.label})` : ''));

        if (!connections.has(edge.targetId)) connections.set(edge.targetId, []);
        connections
          .get(edge.targetId)!
          .push(sourceTitle + (edge.label ? ` (${edge.label})` : ''));
      }
    }

    return docNodes
      .map((k) => {
        const conn = connections.get(k.id);
        const connStr =
          conn && conn.length > 0 ? ` (Connected to: ${conn.join(', ')})` : '';
        return `- ${k.title} [Type: ${k.type}]${connStr}`;
      })
      .join('\n');
  }

  async searchNodes(query: string): Promise<string> {
    const { nodes, edges } = await this.repository.findActiveWithEdges();
    const docNodes = nodes.filter((n) => n.id !== 'main-ai-node');
    if (docNodes.length === 0) return 'No data found.';

    const q = query.toLowerCase();
    const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    const matchScore = (s: string) => {
      const lower = s.toLowerCase();
      if (lower.includes(q)) return 3;
      return tokens.reduce(
        (score, t) => (lower.includes(t) ? score + 1 : score),
        0,
      );
    };
    const scored = docNodes.map((n) => ({
      node: n,
      score: matchScore(n.title) + matchScore(n.type),
    }));
    const best = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    const targetNode = best[0]?.node;
    if (!targetNode) return 'Node not found in the Knowledge Graph.';

    const connectedIds = new Set<string>();
    for (const { node } of best.slice(0, 3)) {
      connectedIds.add(node.id);
      for (const edge of edges) {
        if (edge.sourceId === node.id) connectedIds.add(edge.targetId);
        if (edge.targetId === node.id) connectedIds.add(edge.sourceId);
      }
    }

    const connectedNodes = docNodes.filter((n) => connectedIds.has(n.id));
    const MAX_RELEVANT_URLS = 15;

    return connectedNodes
      .map((k) => {
        let urlsStr = '';
        try {
          const urls = JSON.parse(k.urls || '[]');
          if (Array.isArray(urls) && urls.length > 0) {
            const ranked = this.rankUrls(urls, q, tokens);
            const top = ranked.slice(0, MAX_RELEVANT_URLS);
            const hidden = urls.length - top.length;
            urlsStr = `\n\nURLs:\n${top.map((u) => `- ${u}`).join('\n')}`;
            if (hidden > 0)
              urlsStr += `\n(+${hidden} more product URLs available)`;
          }
        } catch {
          /* ignore */
        }
        const cityStr = k.city ? `\n\nDefault location: ${k.city}` : '';
        return `--- ${k.title} [${k.type}] ---\n${k.content}${cityStr}${urlsStr}`;
      })
      .join('\n\n');
  }

  /**
   * Generic URL ranker: extracts tokens from URL path/params, scores against query.
   * Works for any e-commerce site structure (cititex, tokopedia, shopee, etc.)
   */
  private rankUrls(
    urls: string[],
    query: string,
    queryTokens: string[],
  ): string[] {
    const tokenCache = new Map<string, string[]>();

    const urlTokens = (url: string): string[] => {
      const cached = tokenCache.get(url);
      if (cached) return cached;

      let tokens: string[];
      try {
        const parsed = new URL(url);
        const pathTokens = parsed.pathname
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length >= 2);
        const paramTokens = [...parsed.searchParams.values()]
          .join(' ')
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length >= 2);
        tokens = [...pathTokens, ...paramTokens];
      } catch {
        tokens = url
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length >= 2);
      }
      tokenCache.set(url, tokens);
      return tokens;
    };

    const scored = urls.map((url) => {
      const tokens = urlTokens(url);
      const tokenSet = new Set(tokens);
      let score = 0;
      // exact query substring in full URL = strong signal
      if (url.toLowerCase().includes(query)) score += 10;
      // each query token that appears in URL tokens
      for (const qt of queryTokens) {
        if (tokenSet.has(qt)) score += 3;
        else if (tokens.some((t) => t.includes(qt))) score += 1;
      }
      return { url, score };
    });

    return scored.sort((a, b) => b.score - a.score).map((s) => s.url);
  }
}
