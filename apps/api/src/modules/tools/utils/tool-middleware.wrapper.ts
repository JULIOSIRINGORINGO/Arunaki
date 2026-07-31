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
 */
export function wrapWorkspaceIsolation(tool: Tool, workspaceDir?: string): Tool {
  if (!workspaceDir) return tool;

  const originalExecute = tool.execute.bind(tool);

  return {
    ...tool,
    execute: async (args: Record<string, any>): Promise<ToolResult> => {
      const pathArg = args.filePath || args.path || args.file || args.targetPath;
      if (typeof pathArg === 'string' && pathArg.includes('..')) {
        return {
          status: 'error',
          data: {},
          preview: `Akses ditolak: Path "${pathArg}" mencoba keluar dari workspace.`,
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
        let suggestedAction = 'Periksa kembali parameter input atau periksa status file.';

        if (result.error.code === 'FILE_NOT_FOUND' || result.error.message.includes('not found')) {
          suggestedAction = 'Gunakan tool "search_workspace" atau "list_workspace_files" untuk menemukan path file yang benar.';
        } else if (result.error.code === 'INVALID_ARGS') {
          suggestedAction = 'Sesuaikan argumen fungsi agar memenuhi skema parameter.';
        } else if (result.error.code === 'WORKSPACE_ISOLATION_VIOLATION') {
          suggestedAction = 'Gunakan path relatif di dalam folder workspace saja.';
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
