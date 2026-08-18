import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Tool, ToolDefinition } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { KnowledgeCrawlerService } from '../../knowledge/services/knowledge-crawler.service.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';

/**
 * KnowledgeLiveFetchTool
 *
 * Universal, domain-agnostic live crawler tool.
 * Extracts real-time content from any external web source, live document,
 * portal, news feed, catalog, or spreadsheet registered in the Knowledge Hub.
 */
@Injectable()
export class KnowledgeLiveFetchTool implements Tool {
  private readonly logger = new Logger(KnowledgeLiveFetchTool.name);

  constructor(
    @Inject(forwardRef(() => KnowledgeCrawlerService))
    private readonly crawlerService: KnowledgeCrawlerService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
  ) {}

  get name(): string {
    return 'knowledge_live_fetch';
  }

  get displayName(): string {
    return 'Live Knowledge Fetch';
  }

  get capability() {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      tags: ['knowledge', 'live', 'crawler', 'web', 'data', 'docs', 'news', 'portal', 'spreadsheet'],
      inputSchema: {
        query: 'The topic, question, keyword, item, or specific data field to extract from the live source',
        url: 'Optional explicit web URL to crawl. If omitted, automatically resolves from workspace Knowledge nodes.',
        options: 'Optional extraction options or dynamic query filters (e.g. { category: "...", location: "..." })',
        workspaceId: 'Optional workspace identifier',
      },
      outputType: 'json',
      estimatedLatency: 'medium' as const,
    };
  }

  get description(): string {
    return 'Fetches, crawls, and extracts real-time live content from any registered external URL, web portal, news source, live catalog, documentation page, or cloud spreadsheet linked in the workspace Knowledge Hub.';
  }

  get definition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search objective, question, topic, keyword, or data field to find and extract from the target page (e.g. "latest price update", "stock availability", "breaking news", "regulation rules")',
            },
            url: {
              type: 'string',
              description: 'Optional explicit URL to inspect. If omitted, the tool automatically matches and selects the relevant active URL from workspace Knowledge nodes.',
            },
            options: {
              type: 'object',
              description: 'Optional extraction directives or query filters (e.g. { selector: "article", filters: { key: "value" } })',
            },
            workspaceId: {
              type: 'string',
              description: 'Workspace ID to resolve registered Knowledge links.',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  get isMutating(): boolean {
    return false;
  }

  get timeoutMs(): number {
    return 45000;
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const { query, url: explicitUrl, options = {}, workspaceId } = args;

    if (!query || typeof query !== 'string') {
      return {
        status: 'error',
        data: {},
        preview: 'Parameter `query` is required.',
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INVALID_ARGS', message: 'Parameter query is required' },
      };
    }

    try {
      let targetUrl = explicitUrl;

      // Dynamically resolve target URL from workspace Knowledge links if not explicitly given
      if (!targetUrl) {
        const knowledgeNodes = await this.prisma.knowledge.findMany({
          where: {
            active: true,
          },
        });

        // 1. Prioritize node whose title or content matches query keywords
        const normalizedQuery = query.toLowerCase();
        const scoredNodes = knowledgeNodes
          .filter((n) => n.content?.startsWith('http'))
          .map((n) => {
            const title = n.title.toLowerCase();
            let score = 0;
            if (normalizedQuery.includes(title) || title.includes(normalizedQuery)) score += 10;
            const words = normalizedQuery.split(/\s+/);
            for (const w of words) {
              if (w.length > 2 && title.includes(w)) score += 2;
            }
            return { node: n, score };
          })
          .sort((a, b) => b.score - a.score);

        if (scoredNodes.length > 0 && scoredNodes[0].node.content) {
          targetUrl = scoredNodes[0].node.content;
        }
      }

      if (!targetUrl) {
        return {
          status: 'error',
          data: {},
          preview: `No active Knowledge link or URL found matching query: "${query}". Please provide an explicit URL or add a link to the Knowledge Hub.`,
          metadata: {
            toolName: this.name,
            displayName: this.displayName,
            executionTime: Date.now() - startTime,
          },
          error: { code: 'NO_KNOWLEDGE_URL', message: 'No active Knowledge URL configured' },
        };
      }

      this.logger.log(
        `[KnowledgeLiveFetch] Crawling live content: query="${query}", URL="${targetUrl}"`,
      );

      const result = await this.crawlerService.fetchLiveKnowledge({
        url: targetUrl,
        query,
        filters: options?.filters || options,
        selector: options?.selector,
      });

      return {
        status: 'success',
        data: result,
        preview: `Live content fetched for "${query}" from "${result.title}" (${result.url}). Extracted ${result.extractedContent.length} chars.`,
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`[KnowledgeLiveFetch] Crawl error: ${error.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Failed to fetch live knowledge: ${error.message}`,
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
        error: { code: 'CRAWL_FAILED', message: error.message },
      };
    }
  }
}
