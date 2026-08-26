import { ToolResult } from './interfaces/tool-result.interface.js';

/**
 * Tool execution context — injected by the registry at call time.
 * Contains workspace root path (resolved once per run, no DB lookup).
 */
export interface ToolContext {
  workspaceRoot: string;
}

/**
 * Tool definition — matches OpenCode's Tool.Def pattern.
 */
export interface ToolDef {
  id: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult> | ToolResult;
}

/**
 * Create a tool definition — matches OpenCode's Tool.define().
 */
export function define<ID extends string>(
  id: ID,
  def: Omit<ToolDef, 'id'>,
): ToolDef & { id: ID } {
  return { ...def, id };
}
