import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fsSync from 'fs';
import { promises as fsp } from 'fs';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ReadTool } from '../file/read.js';
import { WriteTool } from '../file/write.js';
import { EditTool } from '../file/edit.js';
import { DeleteTool } from '../file/delete.js';
import { RenameTool } from '../file/rename.js';
import { ListTool } from '../file/list.js';
import { GrepTool } from '../file/grep.js';

const BACKUP_DIR = '.arunaki_backups';
const MAX_BACKUPS = 5;

@Injectable()
export class WorkspaceToolsService {
  private readonly logger = new Logger(WorkspaceToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enforces that a target path is strictly contained within the workspace root.
   */
  private requirePathInWorkspace(targetPath: string, rootPath: string): string {
    let resolvedRoot = path.resolve(rootPath);
    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(resolvedRoot, targetPath);
    try {
      resolvedRoot = fsSync.realpathSync(resolvedRoot);
    } catch {
      /* root may not exist yet */
    }
    let realTarget = resolvedTarget;
    try {
      realTarget = fsSync.realpathSync(resolvedTarget);
    } catch {
      try {
        const parent = path.dirname(resolvedTarget);
        realTarget = path.join(fsSync.realpathSync(parent), path.basename(resolvedTarget));
      } catch {
        /* fall back to lexical */
      }
    }
    const rel = path.relative(resolvedRoot, realTarget);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(
        'Path Traversal detected. Target path is outside workspace root.',
      );
    }
    return resolvedTarget;
  }

  /**
   * Resolves a caller-supplied path against the workspace root and returns the
   * safe absolute path, or throws if the path escapes the workspace.
   */
  async resolveWithinWorkspace(
    workspaceId: string,
    targetPath: string,
  ): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });
    if (!workspace?.rootPath) {
      throw new Error(
        `Workspace "${workspaceId}" not found or root path is missing`,
      );
    }
    const normalized = targetPath.replace(/\\{2,}/g, '\\');
    return this.requirePathInWorkspace(normalized, workspace.rootPath);
  }

  /**
   * Creates a rolling backup of a file before editing.
   */
  async createRollingBackup(
    workspaceRoot: string,
    filename: string,
  ): Promise<string> {
    const sourcePath = path.join(workspaceRoot, filename);
    const backupDir = path.join(workspaceRoot, BACKUP_DIR);

    await fsp.mkdir(backupDir, { recursive: true });

    let fd: fsp.FileHandle | undefined;
    try {
      fd = await fsp.open(sourcePath, 'r');
    } catch (err: any) {
      throw new Error(
        `Failed to create backup: file "${filename}" is in use or inaccessible. (${err.code})`,
      );
    } finally {
      if (fd) await fd.close();
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.basename(filename);
    const backupName = `${baseName}.backup-${timestamp}`;
    const backupPath = path.join(backupDir, backupName);

    try {
      await fsp.copyFile(sourcePath, backupPath);
      this.logger.log(`Backup created: ${backupPath}`);
    } catch (err: any) {
      throw new Error(
        `Failed to create backup for "${filename}": ${err.message}.`,
      );
    }

    try {
      const allFiles = await fsp.readdir(backupDir);
      const backupsForFile = allFiles
        .filter((f) => f.startsWith(baseName + '.backup-'))
        .sort();

      if (backupsForFile.length > MAX_BACKUPS) {
        const toDelete = backupsForFile.slice(
          0,
          backupsForFile.length - MAX_BACKUPS,
        );
        for (const old of toDelete) {
          await fsp.unlink(path.join(backupDir, old));
        }
      }
    } catch {
      /* Backup cleanup failure fallback */
    }

    return backupPath;
  }

  /**
   * Resolve workspace root from workspaceId (for backward compatibility).
   * New tools should use workspaceRoot directly from context.
   */
  async getWorkspaceRoot(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });
    if (!workspace?.rootPath) {
      throw new Error(`Workspace "${workspaceId}" not found`);
    }
    return workspace.rootPath;
  }

  async readWorkspaceFile(
    filePath: string,
    workspaceId: string,
    opts?: { offset?: number; limit?: number },
  ): Promise<ToolResult> {
    const rootPath = await this.getWorkspaceRoot(workspaceId);
    return ReadTool.execute({ filePath, ...opts }, { workspaceRoot: rootPath });
  }

  async writeWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
    format: string;
    content?: string;
    rows?: Record<string, any>[];
    title?: string;
  }): Promise<ToolResult> {
    const rootPath = await this.getWorkspaceRoot(params.workspaceId);
    return WriteTool.execute({ filePath: params.filename, content: params.content || '' }, { workspaceRoot: rootPath });
  }

  async editWorkspaceFile(params: {
    workspaceId: string;
    path: string;
    patchText: string;
  }): Promise<ToolResult> {
    const rootPath = await this.getWorkspaceRoot(params.workspaceId);
    return EditTool.execute({ filePath: params.path, oldString: '', newString: params.patchText }, { workspaceRoot: rootPath });
  }

  async deleteWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
  }): Promise<ToolResult> {
    const rootPath = await this.getWorkspaceRoot(params.workspaceId);
    return DeleteTool.execute({ filePath: params.filename }, { workspaceRoot: rootPath });
  }

  async renameWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
    newFilename: string;
  }): Promise<ToolResult> {
    const rootPath = await this.getWorkspaceRoot(params.workspaceId);
    return RenameTool.execute({ oldPath: params.filename, newPath: params.newFilename }, { workspaceRoot: rootPath });
  }

  async listWorkspaceFiles(workspaceId: string): Promise<ToolResult> {
    const rootPath = await this.getWorkspaceRoot(workspaceId);
    return ListTool.execute({}, { workspaceRoot: rootPath });
  }

  async searchWorkspace(
    workspaceId: string,
    query: string,
  ): Promise<ToolResult> {
    const rootPath = await this.getWorkspaceRoot(workspaceId);
    return GrepTool.execute({ pattern: query }, { workspaceRoot: rootPath });
  }
}
