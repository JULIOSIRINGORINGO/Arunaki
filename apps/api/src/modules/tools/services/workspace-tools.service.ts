import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { EditToolService } from './edit-tool.service.js';
import { WriteToolService } from './write-tool.service.js';
import { ReadToolService } from './read-tool.service.js';
import { DeleteToolService } from './delete-tool.service.js';
import { RenameToolService } from './rename-tool.service.js';
import { ListToolService } from './list-tool.service.js';
import { SearchToolService } from './search-tool.service.js';

const BACKUP_DIR = '.arunaki_backups';
const MAX_BACKUPS = 5;

@Injectable()
export class WorkspaceToolsService {
  private readonly logger = new Logger(WorkspaceToolsService.name);

  constructor(
    @Inject(forwardRef(() => EditToolService))
    private readonly editTool: EditToolService,
    @Inject(forwardRef(() => WriteToolService))
    private readonly writeTool: WriteToolService,
    @Inject(forwardRef(() => ReadToolService))
    private readonly readTool: ReadToolService,
    @Inject(forwardRef(() => DeleteToolService))
    private readonly deleteTool: DeleteToolService,
    @Inject(forwardRef(() => RenameToolService))
    private readonly renameTool: RenameToolService,
    @Inject(forwardRef(() => ListToolService))
    private readonly listTool: ListToolService,
    @Inject(forwardRef(() => SearchToolService))
    private readonly searchTool: SearchToolService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enforces that a target path is strictly contained within the workspace root.
   * Defends against Path Traversal / LFI attacks.
   */
  private requirePathInWorkspace(targetPath: string, rootPath: string): string {
    const resolvedRoot = path.resolve(rootPath);
    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(resolvedRoot, targetPath);
    const rel = path.relative(resolvedRoot, resolvedTarget);
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
    return this.requirePathInWorkspace(targetPath, workspace.rootPath);
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

  async readWorkspaceFile(
    filePath: string,
    workspaceId: string,
    opts?: { offset?: number; limit?: number },
  ): Promise<ToolResult> {
    return this.readTool.execute({ filePath, workspaceId, ...opts });
  }

  async writeWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
    format: string;
    content?: string;
    rows?: Record<string, any>[];
    title?: string;
  }): Promise<ToolResult> {
    return this.writeTool.execute(params);
  }

  async editWorkspaceFile(params: {
    workspaceId: string;
    path: string;
    patchText: string;
  }): Promise<ToolResult> {
    return this.editTool.execute(params);
  }

  async deleteWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
  }): Promise<ToolResult> {
    return this.deleteTool.execute(params);
  }

  async renameWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
    newFilename: string;
  }): Promise<ToolResult> {
    return this.renameTool.execute(params);
  }

  async listWorkspaceFiles(workspaceId: string): Promise<ToolResult> {
    return this.listTool.execute(workspaceId);
  }

  async searchWorkspace(
    workspaceId: string,
    query: string,
  ): Promise<ToolResult> {
    return this.searchTool.execute(workspaceId, query);
  }
}
