import { Injectable } from '@nestjs/common';
import { Tool } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ToolRegistryService } from '../tool-registry.service.js';

@Injectable()
export class ToolSearchTool implements Tool {
  constructor(private readonly registry: ToolRegistryService) {}

  readonly name = 'tool_search';
  readonly displayName = 'Search Tools Catalog';
  readonly description = 'Search the background catalog for hidden tools by keyword.';
  readonly catalogMode = 'direct-only';

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'tool_search',
      description: 'Search the background catalog for hidden tools by keyword.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keyword to search for in tool names and descriptions.',
          },
        },
        required: ['query'],
      },
    },
  };

  readonly capability = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    tags: ['system', 'catalog'],
    inputSchema: { query: 'string' },
    outputType: 'object',
    estimatedLatency: 'fast' as const,
  };

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const query = args.query;
    if (!query) {
      return {
        status: 'error',
        data: {},
        preview: 'Query is required.',
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: 0 },
        error: { code: 'INVALID_ARGS', message: 'Query string is required' },
      };
    }

    const start = Date.now();
    const results = this.registry.searchTools(query);
    return {
      status: 'success',
      data: { results },
      preview: `Found ${results.length} matching tools.`,
      metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - start },
    };
  }
}
