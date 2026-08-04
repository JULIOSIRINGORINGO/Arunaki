import { Injectable } from '@nestjs/common';
import * as vm from 'node:vm';
import { Tool } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ToolRegistryService } from '../tool-registry.service.js';

@Injectable()
export class ToolSearchCodeTool implements Tool {
  constructor(private readonly registry: ToolRegistryService) {}

  readonly name = 'tool_search_code';
  readonly displayName = 'Tool Search Code Mode';
  readonly description = 'Execute JavaScript code in a sandbox to search, describe, and call catalog tools in a single turn.';
  readonly catalogMode = 'direct-only';

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'tool_search_code',
      description: 'Execute JavaScript code in a sandbox to search, describe, and call catalog tools in a single turn. You can use async/await. Return the final result.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The JavaScript code to execute. You have access to the global object `arunaki.tools` with methods: `search(query: string)`, `describe(tool_name: string)`, and `call(tool_name: string, parameters: object)`. MUST return a value at the end of the script.',
          },
        },
        required: ['code'],
      },
    },
  };

  readonly capability = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    tags: ['system', 'catalog', 'code'],
    inputSchema: { code: 'string' },
    outputType: 'any',
    estimatedLatency: 'medium' as const,
  };

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const code = args.code;
    if (!code) {
      return {
        status: 'error',
        data: {},
        preview: 'code string is required.',
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: 0 },
        error: { code: 'INVALID_ARGS', message: 'code string is required' },
      };
    }

    const start = Date.now();
    
    // Create the bridge object
    const bridge = {
      search: (query: string) => this.registry.searchTools(query),
      describe: (name: string) => this.registry.describeTool(name),
      call: (name: string, params: Record<string, any>) => this.registry.executeTool(name, params),
    };

    // Create a sandboxed context
    const sandboxContext = vm.createContext({
      arunaki: { tools: bridge },
      console: {
        log: (...args: any[]) => console.log('[Sandbox Log]', ...args),
        error: (...args: any[]) => console.error('[Sandbox Error]', ...args),
      }
    });

    try {
      // Wrap code in an async IIFE so the LLM can use `await` and `return` easily
      const wrappedCode = `(async () => {\n${code}\n})()`;
      const script = new vm.Script(wrappedCode);
      const result = await script.runInContext(sandboxContext, { timeout: 15000 });

      return {
        status: 'success',
        data: { result },
        preview: 'Script executed successfully.',
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - start },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Error executing script: ${e.message}`,
        metadata: { toolName: this.name, displayName: this.displayName, executionTime: Date.now() - start },
        error: { code: 'SCRIPT_EXECUTION_ERROR', message: e.message },
      };
    }
  }
}
