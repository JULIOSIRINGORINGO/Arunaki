import { Injectable } from '@nestjs/common';
import { Tool } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ToolRegistryService } from '../tool-registry.service.js';

@Injectable()
export class ToolDescribeTool implements Tool {
  constructor(private readonly registry: ToolRegistryService) {}

  readonly name = 'tool_describe';
  readonly displayName = 'Describe Tool Schema';
  readonly description = 'Get the exact JSON schema definition for a specific tool by its name.';
  readonly catalogMode = 'direct-only';

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'tool_describe',
      description: 'Get the exact JSON schema definition for a specific tool by its name.',
      parameters: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'The exact name of the tool to describe.',
          },
        },
        required: ['tool_name'],
      },
    },
  };

  readonly capability = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    tags: ['system', 'catalog'],
    inputSchema: { tool_name: 'string' },
    outputType: 'object',
    estimatedLatency: 'fast' as const,
  };

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const toolName = args.tool_name;
    if (!toolName) {
      return {
        status: 'error',
        data: {},
        preview: 'tool_name is required.',
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: 0 },
        error: { code: 'INVALID_ARGS', message: 'tool_name string is required' },
      };
    }

    const start = Date.now();
    const schema = this.registry.describeTool(toolName);
    
    if (!schema) {
      return {
        status: 'error',
        data: {},
        preview: `Tool '${toolName}' not found in catalog.`,
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - start },
        error: { code: 'TOOL_NOT_FOUND', message: `Tool '${toolName}' not found` },
      };
    }

    return {
      status: 'success',
      data: { schema },
      preview: `Successfully retrieved schema for ${toolName}.`,
      metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - start },
    };
  }
}
