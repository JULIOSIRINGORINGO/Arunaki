import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { FileService } from '../../file/file.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import * as Patch from './apply-patch.js';

@Injectable()
export class EditToolService {
  private readonly logger = new Logger(EditToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
  ) {}

  /**
   * Performs surgical edits on an existing file using dual-mode execution:
   * Mode 1: Exact string replacement (`oldText` & `newText`)
   * Mode 2: Opencode patch dry-run engine (`patchText`)
   */
  async execute(params: {
    workspaceId: string;
    filename: string;
    patchText?: string;
    oldText?: string;
    newText?: string;
  }): Promise<ToolResult> {
    const { workspaceId, filename, patchText, oldText, newText } = params;
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
        if (match) targetPath = match.path;
      } catch {
        /* Fallback */
      }
    }

    try {
      const original = await fsPromises.readFile(targetPath, 'utf-8');

      // Mode 1: Exact String Replacement (oldText & newText)
      if (typeof oldText === 'string' && typeof newText === 'string') {
        if (!original.includes(oldText)) {
          return {
            status: 'error',
            data: {},
            preview: `Failed to edit "${filename}": target oldText was not found in file.`,
            metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
            error: { code: 'OLD_TEXT_NOT_FOUND', message: 'Target oldText not found in file' },
          };
        }
        const updatedContent = original.replace(oldText, newText);
        await fsPromises.writeFile(targetPath, updatedContent, 'utf-8');
        return {
          status: 'success',
          data: { path: targetPath, filename, editsApplied: 1 },
          preview: `Successfully edited "${filename}" using string replacement.`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime, filename, editsApplied: 1 },
        };
      }

      // Mode 2: Opencode Diff Patch Engine (patchText)
      if (!patchText || !patchText.trim()) {
        return {
          status: 'error',
          data: {},
          preview: 'Empty patch — provide a valid patch with *** Begin Patch / *** End Patch headers.',
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'EMPTY_PATCH', message: 'patchText parameter is empty' },
        };
      }

      let hunks: Patch.Hunk[];
      try {
        hunks = Patch.parse(patchText);
      } catch (e: any) {
        return {
          status: 'error',
          data: {},
          preview: `Invalid patch format: ${e.message}`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'INVALID_PATCH', message: e.message },
        };
      }

      if (hunks.length === 0) {
        return {
          status: 'success',
          data: { path: targetPath, filename, editsApplied: 0 },
          preview: `No changes detected in patch for "${filename}".`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime, filename, editsApplied: 0 },
        };
      }

      const badHunk = hunks.find(
        (h) =>
          h.type !== 'update' ||
          (!!h.path &&
            h.path.split('/').pop()?.toLowerCase() !== filename.split('/').pop()?.toLowerCase()),
      );
      if (badHunk) {
        return {
          status: 'error',
          data: {},
          preview:
            badHunk.type === 'delete'
              ? 'Use delete tool to remove files.'
              : badHunk.type === 'add'
                ? 'Use write tool to create new files.'
                : `Patch target "${badHunk.path}" does not match file "${filename}". Correct the header path.`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'INVALID_PATCH_TARGET', message: 'Patch targets an invalid file or unsupported hunk' },
        };
      }

      let content = original;
      let editsApplied = 0;

      for (const hunk of hunks) {
        if (hunk.type === 'update') {
          const update = Patch.derive(hunk, content, filename);
          content = Patch.joinBom(update.content, update.bom);
          editsApplied += hunk.chunks.length;
        }
      }

      await fsPromises.writeFile(targetPath, content, 'utf-8');

      return {
        status: 'success',
        data: { path: targetPath, filename, editsApplied },
        preview: `Successfully edited "${filename}" with ${editsApplied} patch section(s).`,
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
          filename,
          editsApplied,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to edit file "${filename}": ${e.message}`,
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'EDIT_FAILED', message: e.message },
      };
    }
  }
}
