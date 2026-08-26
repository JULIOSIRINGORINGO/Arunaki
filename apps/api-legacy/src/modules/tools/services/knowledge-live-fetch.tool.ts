import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Tool, ToolDefinition } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { KnowledgeCrawlerService } from '../../knowledge/services/knowledge-crawler.service.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';

/**
 * KnowledgeLiveFetchTool — 1:1 match with opencode webfetch.
 * HTTP fetch + Turndown (HTML→Markdown). No browser.
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
      tags: [
        'knowledge',
        'live',
        'fetch',
        'web',
        'catalog',
        'price',
        'docs',
        'url',
      ],
      inputSchema: {
        url: 'The URL to fetch content from',
        format: 'Format to return: "markdown" (default), "text", or "html"',
        timeout: 'Optional timeout in seconds (max 120)',
        query: 'Optional search context for knowledge resolution',
        workspaceId: 'Optional workspace identifier',
        browser:
          'Set true to render with a real browser (needed for JS-only content)',
      },
      outputType: 'markdown' as const,
      estimatedLatency: 'fast' as const,
    };
  }

  get description(): string {
    return 'Fetches public web content from any URL: catalog info, prices, colors, sizes, descriptions, docs, live data - any general web content. Returns markdown by default. Fast HTTP fetch; set browser=true only when the page is JS-only. NOT for stock availability numbers (use stock_lookup) and NOT for interactive flows (use browser_interaction).';
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
            url: {
              type: 'string',
              description:
                'The URL to fetch content from (must start with http:// or https://)',
            },
            format: {
              type: 'string',
              enum: ['markdown', 'text', 'html'],
              description:
                'Format to return the content in. Defaults to markdown.',
            },
            timeout: {
              type: 'number',
              description:
                'Optional timeout in seconds (max 120). Default: 30.',
            },
            query: {
              type: 'string',
              description: 'Optional search context for knowledge resolution.',
            },
            workspaceId: {
              type: 'string',
              description:
                'Optional workspace ID to resolve registered Knowledge links.',
            },
            browser: {
              type: 'boolean',
              description:
                'Set true to render with a real browser (Playwright). Needed for JS-only content.',
            },
          },
          required: ['url'],
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
    const {
      url: explicitUrl,
      format = 'markdown',
      timeout,
      query = '',
      workspaceId,
    } = args;

    if (!explicitUrl || typeof explicitUrl !== 'string') {
      return {
        status: 'error',
        data: {},
        preview: 'Parameter `url` is required.',
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INVALID_ARGS', message: 'Parameter url is required' },
      };
    }

    if (
      !explicitUrl.startsWith('http://') &&
      !explicitUrl.startsWith('https://')
    ) {
      return {
        status: 'error',
        data: {},
        preview: 'URL must start with http:// or https://',
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'INVALID_URL',
          message: 'URL must start with http:// or https://',
        },
      };
    }

    try {
      this.logger.log(
        `[KnowledgeLiveFetch] Fetching: ${explicitUrl} (format: ${format})`,
      );

      const result = await this.crawlerService.fetchLiveKnowledge({
        url: explicitUrl,
        query,
        format,
        timeout,
        browser: args.browser === true || args.browser === 'true',
      });

      return {
        status: 'success',
        data: result,
        preview: `Fetched ${result.extractedContent.length} chars from "${result.title}" (${result.url}).`,
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`[KnowledgeLiveFetch] Fetch error: ${error.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Failed to fetch: ${error.message}`,
        metadata: {
          toolName: this.name,
          displayName: this.displayName,
          executionTime: Date.now() - startTime,
        },
        error: { code: 'FETCH_FAILED', message: error.message },
      };
    }
  }
}
