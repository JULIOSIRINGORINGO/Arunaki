import { Tool } from '../interfaces/tool.interface.js';

/**
 * ToolAdapter — compatibility shim for registrars that still use the old pattern.
 *
 * The new file tools (read/write/edit/glob/grep/list/delete/rename) use
 * Tool.define() + registerFromDef() directly — no adapter needed.
 *
 * This adapter exists ONLY for non-file registrars (business-domain, desktop,
 * harness-meta) that will be migrated later.
 */
export class ToolAdapter {
  static from(def: {
    name: string;
    displayName: string;
    description: string;
    tags?: string[];
    mutating?: boolean;
    cacheable?: boolean;
    timeoutMs?: number;
    parameters: Record<string, any>;
    handler: (args: Record<string, any>) => Promise<any> | any;
  }): Tool {
    return {
      name: def.name,
      displayName: def.displayName,
      description: def.description,
      definition: {
        type: 'function',
        function: {
          name: def.name,
          description: def.description,
          parameters: def.parameters,
        },
      },
      capability: {
        name: def.name,
        displayName: def.displayName,
        description: def.description,
        tags: def.tags || [],
        inputSchema: {},
        outputType: 'ToolResult',
        estimatedLatency: 'fast',
      },
      timeoutMs: def.timeoutMs ?? 10000,
      mutating: def.mutating,
      cacheable: def.cacheable,
      execute: def.handler,
    };
  }
}
