import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { FileService } from '../../file/file.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class DeleteToolService {
  private readonly logger = new Logger(DeleteToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => StorageService)) private readonly storageService: StorageService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
  ) {}

  async execute(params: { workspaceId: string; filename: string }): Promise<ToolResult> {
    const { workspaceId, filename } = params;
    const startTime = Date.now();

    let rootPath: string | null = null;
    if (this.prisma) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { rootPath: true },
      });
      rootPath = workspace?.rootPath || null;
    }

    if (!rootPath) {
      rootPath = process.env.WORKSPACE_ROOT || 'E:\\LAPORAN';
    }

    let targetPath = path.join(rootPath, filename);
    const fsPromises = await import('fs/promises');
    let fileExists = false;
    try {
      await fsPromises.access(targetPath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (!fileExists && this.fileService) {
      try {
        const files = await this.fileService.findByWorkspaceId(workspaceId);
        const match = files.find(
          (f) =>
            f.name.toLowerCase() === filename.toLowerCase() ||
            f.name.toLowerCase().startsWith(filename.toLowerCase() + '.') ||
            f.name.toLowerCase().replace(/\.[^.]+$/, '') === filename.toLowerCase(),
        );
        if (match) {
          targetPath = match.path;
          fileExists = true;
        }
      } catch {
        /* Fallback */
      }
    }

    if (!fileExists) {
      return {
        status: 'error',
        data: {},
        preview: `File "${filename}" was not found in the workspace.`,
        metadata: { toolName: 'delete', displayName: 'Delete File', executionTime: Date.now() - startTime },
        error: { code: 'FILE_NOT_FOUND', message: `File "${filename}" not found` },
      };
    }

    try {
      const trashDir = path.join(rootPath, '.arunaki-trash');
      await fsPromises.mkdir(trashDir, { recursive: true });
      const trashPath = path.join(trashDir, `${Date.now()}_${path.basename(targetPath)}`);
      await fsPromises.rename(targetPath, trashPath);

      if (this.fileService) {
        try {
          const existingFiles = await this.fileService.findByWorkspaceId(workspaceId);
          const existing = existingFiles.find((f) => f.path === targetPath);
          if (existing) {
            await this.fileService.delete(existing.id);
          }
        } catch {
          /* DB removal fallback */
        }
      }

      return {
        status: 'success',
        data: { filename, trashPath },
        preview: `Successfully moved "${filename}" to trash (.arunaki-trash).`,
        metadata: { toolName: 'delete', displayName: 'Delete File', executionTime: Date.now() - startTime, filename },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to delete file "${filename}": ${e.message}`,
        metadata: { toolName: 'delete', displayName: 'Delete File', executionTime: Date.now() - startTime },
        error: { code: 'DELETE_FAILED', message: e.message },
      };
    }
  }
}
