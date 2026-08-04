import { Tool } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

/**
 * ToolConfig — configuration for creating a ToolAdapter.
 */
export interface ToolConfig {
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  handler: (args: Record<string, any>) => Promise<ToolResult> | ToolResult;
  parameters: Record<string, any>;
  outputType?:
    'text' | 'spreadsheet' | 'document' | 'calculation' | 'presentation';
  estimatedLatency?: 'fast' | 'medium' | 'slow';
  timeoutMs?: number;
  /** 'catalog-only' (default) = hidden, discoverable via tool_search; 'direct-only' = always sent to LLM. */
  catalogMode?: 'direct-only' | 'catalog-only';
}

/**
 * ToolAdapter — wraps existing tool services into the Tool interface.
 *
 * Allows gradual migration from monolithic registration to
 * self-registering pattern without rewriting all tool services.
 */
export class ToolAdapter implements Tool {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly definition: Tool['definition'];
  readonly capability: Tool['capability'];
  readonly timeoutMs: number;

  private readonly handler: (
    args: Record<string, any>,
  ) => Promise<ToolResult> | ToolResult;

  readonly catalogMode?: 'direct-only' | 'catalog-only';

  private constructor(config: ToolConfig) {
    this.name = config.name;
    this.displayName = config.displayName;
    this.description = config.description;
    this.handler = config.handler;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.catalogMode = config.catalogMode ?? 'catalog-only';

    this.definition = {
      type: 'function',
      function: {
        name: config.name,
        description: config.description,
        parameters: config.parameters,
      },
    };

    this.capability = {
      name: config.name,
      displayName: config.displayName,
      description: config.description,
      tags: config.tags,
      inputSchema: this.extractInputSchema(config.parameters),
      outputType: config.outputType ?? 'text',
      estimatedLatency: config.estimatedLatency ?? 'fast',
    };
  }

  execute(args: Record<string, any>): Promise<ToolResult> | ToolResult {
    return this.handler(args);
  }

  /**
   * Create a ToolAdapter from a config object.
   */
  static from(config: ToolConfig): ToolAdapter {
    return new ToolAdapter(config);
  }

  /**
   * Extract input schema from parameters for capability display.
   */
  private extractInputSchema(
    parameters: Record<string, any>,
  ): Record<string, string> {
    const schema: Record<string, string> = {};
    const properties = parameters.properties || {};
    for (const [key, value] of Object.entries(properties)) {
      schema[key] = (value as any).type || 'string';
    }
    return schema;
  }
}
