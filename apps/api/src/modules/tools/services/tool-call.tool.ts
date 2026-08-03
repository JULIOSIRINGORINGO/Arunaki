import { Injectable } from '@nestjs/common';
import { Tool } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ToolRegistryService } from '../tool-registry.service.js';

@Injectable()
export class ToolCallTool implements Tool {
  constructor(private readonly registry: ToolRegistryService) {}

  readonly name = 'tool_call';
  readonly displayName = 'Call Tool';
  readonly description = 'Execute a tool from the catalog using its exact name and JSON parameters.';
  readonly catalogMode = 'direct-only';

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'tool_call',
      description: 'Execute a tool from the catalog using its exact name and JSON parameters.',
      parameters: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'The exact name of the tool to execute.',
          },
          parameters: {
            type: 'object',
            description: 'The JSON parameters required by the tool. Use tool_describe to get the schema.',
          },
        },
        required: ['tool_name', 'parameters'],
      },
    },
  };

  readonly capability = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    tags: ['system', 'catalog'],
    inputSchema: { tool_name: 'string', parameters: 'object' },
    outputType: 'object',
    estimatedLatency: 'fast' as const,
  };

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const toolName = args.tool_name;
    const parameters = args.parameters || {};

    if (!toolName) {
      return {
        status: 'error',
        data: {},
        preview: 'tool_name is required.',
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: 0 },
        error: { code: 'INVALID_ARGS', message: 'tool_name string is required' },
      };
    }

    return this.registry.executeTool(toolName, parameters);
  }
}
