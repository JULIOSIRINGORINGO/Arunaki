import * as path from 'node:path';
import { Tool } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

export interface ToolMiddlewareOptions {
  workspaceDir?: string;
  enableTelemetry?: boolean;
}

/**
 * Tool Middleware Wrapper — HOF Wrappers inspired by OpenClaw architecture.
 * Provides Workspace Isolation, Actionable Error Enrichment, and Telemetry.
 */

/**
 * 1. Workspace Isolation Wrapper
 * Prevents file paths from escaping the target workspace directory.
 * Uses path.resolve containment check for cross-platform efficiency (Windows & POSIX).
 */
export function wrapWorkspaceIsolation(tool: Tool, workspaceDir?: string): Tool {
  if (!workspaceDir) return tool;

  const originalExecute = tool.execute.bind(tool);
  const normalizedRoot = path.resolve(workspaceDir);

  return {
    ...tool,
    execute: async (args: Record<string, any>): Promise<ToolResult> => {
      const pathArg = args.filePath || args.path || args.file || args.targetPath;

      if (typeof pathArg === 'string') {
        const resolvedPath = path.resolve(normalizedRoot, pathArg);
        const relativePath = path.relative(normalizedRoot, resolvedPath);

        const isOutside = relativePath.startsWith('..') || path.isAbsolute(relativePath);

        if (isOutside) {
          return {
            status: 'error',
            data: {},
            preview: `Access denied: Path "${pathArg}" attempted to escape the workspace.`,
            metadata: {
              toolName: tool.name,
              displayName: tool.capability?.displayName || tool.name,
              executionTime: 0,
            },
            error: {
              code: 'WORKSPACE_ISOLATION_VIOLATION',
              message: `Path traversal denied for path "${pathArg}" outside workspace root "${workspaceDir}"`,
            },
          };
        }
      }

      return originalExecute(args);
    },
  };
}

/**
 * 2. Actionable Error Wrapper
 * Enriches tool execution error responses with structured `suggested_action` for LLM self-correction.
 */
export function wrapActionableError(tool: Tool): Tool {
  const originalExecute = tool.execute.bind(tool);

  return {
    ...tool,
    execute: async (args: Record<string, any>): Promise<ToolResult> => {
      const result = await originalExecute(args);

      if (result.status === 'error' && result.error) {
        let suggestedAction = 'Check the input parameters again or check the file status.';

        if (result.error.code === 'FILE_NOT_FOUND' || result.error.message.includes('not found')) {
          suggestedAction = 'Use the "search_workspace" or "list" tool to find the correct file path.';
        } else if (result.error.code === 'INVALID_ARGS') {
          suggestedAction = 'Adjust the function arguments to match the parameter schema.';
        } else if (result.error.code === 'WORKSPACE_ISOLATION_VIOLATION') {
          suggestedAction = 'Use only relative paths inside the workspace folder.';
        }

        return {
          ...result,
          data: {
            ...result.data,
            suggested_action: suggestedAction,
          },
        };
      }

      return result;
    },
  };
}

/**
 * 3. HOF Pipeline Composer
 * Composes multiple wrappers into a single tool wrapper pipeline.
 */
export function applyToolMiddlewarePipeline(tool: Tool, options: ToolMiddlewareOptions = {}): Tool {
  let wrapped = tool;
  wrapped = wrapWorkspaceIsolation(wrapped, options.workspaceDir);
  wrapped = wrapActionableError(wrapped);
  return wrapped;
}
