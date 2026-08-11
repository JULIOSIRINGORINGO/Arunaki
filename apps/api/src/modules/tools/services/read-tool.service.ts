import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { FileService } from '../../file/file.service.js';
import { ParserService } from '../../parser/parser.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class ReadToolService {
  private readonly logger = new Logger(ReadToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
    @Inject(forwardRef(() => ParserService)) private readonly parserService: ParserService,
  ) {}

  async execute(params: { filePath: string; workspaceId: string }): Promise<ToolResult> {
    const { filePath, workspaceId } = params;
    const startTime = Date.now();

    let targetPath = filePath;

    if (this.prisma) {
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { rootPath: true },
        });
        if (workspace?.rootPath && !path.isAbsolute(filePath)) {
          targetPath = path.join(workspace.rootPath, filePath);
        }
      } catch {
        /* Fallback */
      }
    }

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
            f.name.toLowerCase() === filePath.toLowerCase() ||
            f.name.toLowerCase().startsWith(filePath.toLowerCase() + '.') ||
            f.name.toLowerCase().replace(/\.[^.]+$/, '') === filePath.toLowerCase(),
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
        preview: `File "${filePath}" was not found in the workspace.`,
        metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
        error: { code: 'FILE_NOT_FOUND', message: `File "${filePath}" not found` },
      };
    }

    try {
      const ext = path.extname(targetPath).toLowerCase().replace('.', '') || 'txt';
      const parsed = this.parserService
        ? await this.parserService.parse(targetPath, ext)
        : { content: await fsPromises.readFile(targetPath, 'utf-8'), metadata: {} };

      const filename = path.basename(targetPath);
      const metadata = (parsed as any).metadata || {};

      return {
        status: 'success',
        data: {
          path: targetPath,
          filename,
          content: parsed.content,
          metadata,
        },
        preview: parsed.content.length > 500 ? parsed.content.slice(0, 500) + '...' : parsed.content,
        metadata: {
          toolName: 'read',
          displayName: 'Read File',
          executionTime: Date.now() - startTime,
          filename,
          contentLength: parsed.content.length,
          pageCount: metadata.pageCount || metadata.sheetCount || 1,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to read file "${filePath}": ${e.message}`,
        metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
        error: { code: 'PARSING_FAILED', message: e.message },
      };
    }
  }
}
