import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { FileService } from '../../file/file.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class RenameToolService {
  private readonly logger = new Logger(RenameToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => StorageService)) private readonly storageService: StorageService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
  ) {}

  async execute(params: {
    workspaceId: string;
    filename: string;
    newFilename: string;
  }): Promise<ToolResult> {
    const { workspaceId, filename, newFilename } = params;
    const startTime = Date.now();

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });

    if (!workspace?.rootPath) {
      return {
        status: 'error',
        data: {},
        preview: 'Workspace root path is not connected.',
        metadata: { toolName: 'rename', displayName: 'Rename File', executionTime: Date.now() - startTime },
        error: { code: 'NO_ROOT_PATH', message: 'Workspace root path is not connected' },
      };
    }

    const rootPath = workspace.rootPath;
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
        metadata: { toolName: 'rename', displayName: 'Rename File', executionTime: Date.now() - startTime },
        error: { code: 'FILE_NOT_FOUND', message: `File "${filename}" not found` },
      };
    }

    const cleanNewFilename = newFilename.replace(/[/\\?%*:|"<>]/g, '_');
    const newPath = path.join(path.dirname(targetPath), cleanNewFilename);

    try {
      await fsPromises.rename(targetPath, newPath);

      if (this.fileService && this.prisma) {
        try {
          const existingFiles = await this.fileService.findByWorkspaceId(workspaceId);
          const existing = existingFiles.find((f) => f.path === targetPath);
          if (existing) {
            const ext = path.extname(cleanNewFilename).toLowerCase().replace('.', '');
            await this.fileService.updateContent(existing.id, existing.content || '');
            await this.prisma.file.update({
              where: { id: existing.id },
              data: { name: cleanNewFilename, path: newPath, type: ext || existing.type },
            });
          }
        } catch {
          /* DB sync fallback */
        }
      }

      return {
        status: 'success',
        data: { oldFilename: filename, newFilename: cleanNewFilename, newPath },
        preview: `Successfully renamed "${filename}" to "${cleanNewFilename}".`,
        metadata: {
          toolName: 'rename',
          displayName: 'Rename File',
          executionTime: Date.now() - startTime,
          oldFilename: filename,
          newFilename: cleanNewFilename,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to rename file "${filename}": ${e.message}`,
        metadata: { toolName: 'rename', displayName: 'Rename File', executionTime: Date.now() - startTime },
        error: { code: 'RENAME_FAILED', message: e.message },
      };
    }
  }
}
