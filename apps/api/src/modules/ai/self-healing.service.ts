import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import * as path from 'path';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

/**
 * SelfHealingService — workspace path isolation guard.
 *
 * OpenCode pattern: a failed tool call is returned to the model verbatim and
 * the model self-corrects on its next turn. No auto-retry, no fallback
 * tools, no heuristic argument rewriting — that machinery hid failures from
 * the LLM (it thought the tool succeeded) and made the agent look dumber.
 *
 * The only thing this service still does is the Workspace Isolation check
 * (path traversal protection), which is a hard security boundary and is
 * therefore kept at the execution gate.
 */
@Injectable()
export class SelfHealingService {
  private readonly logger = new Logger(SelfHealingService.name);

  constructor(
    @Inject(ToolRegistryService) private readonly toolRegistryService: ToolRegistryService,
    @Inject(PrismaService) @Optional() private readonly prisma?: PrismaService,
  ) {}

  /**
   * Execute a tool once with workspace path isolation validation.
   * Failures are returned to the caller — and from there to the LLM —
   * unchanged, so the model sees the real error and can fix it.
   */
  async executeWithIsolation(
    toolName: string,
    args: Record<string, any>,
    workspaceId?: string,
  ): Promise<ToolResult> {
    // Workspace Isolation: validate paths before execution
    if (workspaceId && this.prisma) {
      try {
        await this.validateToolPaths(toolName, args, workspaceId);
      } catch (err: any) {
        this.logger.warn(`Workspace isolation blocked: ${err.message}`);
        return {
          status: 'error',
          data: {},
          preview: `Access denied: ${err.message}`,
          metadata: {
            toolName,
            displayName: toolName,
            executionTime: 0,
          },
          error: {
            code: 'WORKSPACE_ISOLATION_VIOLATION',
            message: err.message,
          },
        };
      }
    }

    return this.toolRegistryService.executeTool(toolName, args);
  }

  /**
   * Get workspace root path for isolation validation.
   */
  private async getWorkspaceRootPath(workspaceId: string): Promise<string | null> {
    try {
      const workspace = this.prisma
        ? await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { rootPath: true },
          })
        : null;
      return workspace?.rootPath || null;
    } catch {
      return null;
    }
  }

  /**
   * Validate that a path is within the workspace root (Workspace Isolation).
   * Returns validated path or throws if outside workspace.
   */
  validateWorkspacePath(workspaceId: string, requestedPath: string, rootPath: string): string {
    const resolvedRequested = path.resolve(requestedPath);
    const resolvedRoot = path.resolve(rootPath);
    const rel = path.relative(resolvedRoot, resolvedRequested);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(
        `Access denied: Path "${requestedPath}" is outside workspace root "${rootPath}"`,
      );
    }

    return resolvedRequested;
  }

  /**
   * Validate all path-like arguments in tool args against workspace root.
   * Throws if any path is outside workspace.
   */
  async validateToolPaths(
    toolName: string,
    args: Record<string, any>,
    workspaceId: string,
  ): Promise<void> {
    const rootPath = await this.getWorkspaceRootPath(workspaceId);
    if (!rootPath) return; // No workspace root configured — skip validation

    // Recursively find path-like values in args
    const findPaths = (obj: any, prefix = ''): string[] => {
      const paths: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Check if key suggests a path (common patterns)
          if (
            key.includes('path') ||
            key.includes('folder') ||
            key.includes('directory') ||
            key.includes('file') ||
            key.includes('location') ||
            key.includes('root') ||
            key.includes('dir') ||
            key === 'target' ||
            key === 'source' ||
            key === 'destination'
          ) {
            // Only validate absolute paths, paths with separators, or plain
            // traversal values (Gap #13: "." / ".." / "../" resolve outside the
            // workspace but never contain a separator on their own).
            const isTraversal = value === '.' || value === '..' || /^\.\.[/\\]/.test(value);
            if (path.isAbsolute(value) || value.includes('/') || value.includes('\\') || isTraversal) {
              paths.push(value);
            }
          }
        } else if (value && typeof value === 'object') {
          paths.push(...findPaths(value, `${prefix}${key}.`));
        }
      }
      return paths;
    };

    const pathsToValidate = findPaths(args);
    for (const p of pathsToValidate) {
      try {
        this.validateWorkspacePath(workspaceId, p, rootPath);
      } catch (err: any) {
        throw new Error(`Tool "${toolName}" argument validation failed: ${err.message}`);
      }
    }
  }
}
