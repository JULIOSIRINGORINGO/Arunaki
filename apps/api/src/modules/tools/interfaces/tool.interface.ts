import { ToolResult, ToolResultChunk } from './tool-result.interface.js';

/**
 * Tool — interface that every tool service must implement.
 *
 * Each tool is a self-contained service that registers itself
 * into the ToolRegistry via NestJS dependency injection.
 *
 * This replaces the monolithic registerBuiltinTools() pattern
 * with a decentralized, self-registering architecture.
 */
export interface Tool {
  /** Unique tool name (snake_case) */
  readonly name: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Tool description for LLM */
  readonly description: string;

  /** OpenAI function definition */
  readonly definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  };

  /** Capability metadata for tool discovery */
  readonly capability: {
    name: string;
    displayName: string;
    description: string;
    tags: string[];
    inputSchema: Record<string, string>;
    outputType: string;
    estimatedLatency: 'fast' | 'medium' | 'slow';
  };

  /** Timeout in milliseconds */
  readonly timeoutMs?: number;

  /** True if the tool modifies workspace state (requires safety checks) */
  readonly mutating?: boolean;

  /** 
   * Tool exposure mode for LLM prompt compaction. 
   * 'direct-only' (default for core): always visible to LLM.
   * 'catalog-only' (default for most): hidden in a catalog, requires tool_search/describe to use.
   */
  readonly catalogMode?: 'direct-only' | 'catalog-only';

  /** Read-only/idempotent result may be cached per-run (default false). */
  readonly cacheable?: boolean;

  /** Execute the tool with given arguments */
  execute(args: Record<string, any>): Promise<ToolResult> | ToolResult;

  /** Optional: Execute the tool with streaming results for progress reporting */
  executeStreaming?(args: Record<string, any>): AsyncGenerator<ToolResultChunk>;
}

/**
 * ToolDefinition — for backward compatibility with existing code.
 */
export type {
  ToolDefinition,
  ToolCapability,
} from './tool-result.interface.js';
