import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { FileService } from '../../file/file.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class ListToolService {
  private readonly logger = new Logger(ListToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
  ) {}

  async execute(workspaceId: string): Promise<ToolResult> {
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

    let filesToDescribe: { name: string; type: string; size: number; path: string }[] = [];

    if (rootPath) {
      try {
        const fsPromises = await import('fs/promises');
        const entries = await fsPromises.readdir(rootPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const fullPath = path.join(rootPath, entry.name);
            if (entry.isFile()) {
              const stat = await fsPromises.stat(fullPath);
              const ext = path.extname(entry.name).toLowerCase().replace('.', '');
              filesToDescribe.push({
                name: entry.name,
                type: ext || 'file',
                size: stat.size,
                path: fullPath,
              });
            }
          }
        }
      } catch {
        /* Physical directory scan fallback */
      }
    }

    if (filesToDescribe.length === 0 && this.fileService) {
      try {
        const dbFiles = await this.fileService.findByWorkspaceId(workspaceId);
        filesToDescribe = dbFiles.map((f) => ({
          name: f.name,
          type: f.type || 'file',
          size: f.size,
          path: f.path,
        }));
      } catch {
        /* DB scan fallback */
      }
    }

    const fileListText =
      filesToDescribe.length > 0
        ? filesToDescribe
            .map((f) => `- ${f.name} (Type: ${f.type}, Size: ${Math.round(f.size / 1024)} KB)`)
            .join('\n')
        : 'No files in this workspace yet.';

    return {
      status: 'success',
      data: { files: filesToDescribe, total: filesToDescribe.length },
      preview: fileListText,
      metadata: {
        toolName: 'list',
        displayName: 'List Files',
        executionTime: Date.now() - startTime,
        totalFiles: filesToDescribe.length,
      },
    };
  }
}
