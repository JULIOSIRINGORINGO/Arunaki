import { Injectable, Logger } from '@nestjs/common';
import { Tool, ToolDefinition } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { KnowledgeService } from '../../knowledge/knowledge.service.js';

@Injectable()
export class KnowledgeSearchTool implements Tool {
  private readonly logger = new Logger(KnowledgeSearchTool.name);

  constructor(private readonly knowledgeService: KnowledgeService) {}

  get name(): string {
    return 'search_knowledge_graph';
  }

  get displayName(): string {
    return 'Knowledge Search';
  }

  get capability() {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      tags: ['knowledge', 'rag', 'search', 'docs'],
      inputSchema: {
        query: 'Node title or keywords to search in Knowledge Graph (e.g. "Product Catalog" or "Leave Policy")',
      },
      outputType: 'text',
      estimatedLatency: 'fast' as const,
    };
  }

  get description(): string {
    return 'Search and read content from Knowledge Graph Nodes (SOPs, Catalogs, Rules) by title. Automatically pulls content from related nodes.';
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
              description: 'Node title or keywords to search in Knowledge Graph (e.g. "Product Catalog" or "Leave Policy")',
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

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { query } = args;
    const startTime = Date.now();

    if (!query || typeof query !== 'string') {
      return {
        status: 'error',
        data: {},
        preview: 'Parameter `query` wajib diisi berupa string.',
        metadata: {
          toolName: this.name,
          displayName: 'Knowledge Search',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INVALID_ARGS', message: 'Query is required' },
      };
    }

    try {
      this.logger.log(`Searching Knowledge Graph for: ${query}`);
      const content = await this.knowledgeService.searchNodes(query);
      
      return {
        status: 'success',
        data: { content },
        preview: `Hasil pencarian untuk "${query}"`,
        metadata: {
          toolName: this.name,
          displayName: 'Knowledge Search',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error searching knowledge graph: ${error.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Gagal mencari di Knowledge Graph: ${error.message}`,
        metadata: {
          toolName: this.name,
          displayName: 'Knowledge Search',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'SEARCH_FAILED', message: error.message },
      };
    }
  }
}
