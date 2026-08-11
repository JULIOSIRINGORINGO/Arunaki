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
   * Mode 1: Exact string replacement (`oldText` & `newText`) with CRLF normalization
   * Mode 2: Opencode patch dry-run engine (`patchText`) with CRLF normalization
   */
  async execute(params: {
    workspaceId: string;
    filename: string;
    patchText?: string;
    oldText?: string;
    newText?: string;
    content?: string;
  }): Promise<ToolResult> {
    let { workspaceId, filename, patchText, oldText, newText, content } = params as any;
    const startTime = Date.now();

    // Smart parameter resolution fallback (for LLMs passing content instead of patchText/oldText)
    if (!patchText && (!oldText || !newText) && typeof content === 'string') {
      if (content.includes('*** Begin Patch') || content.includes('*** Update File:')) {
        patchText = content;
      }
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });

    if (!workspace?.rootPath) {
      return {
        status: 'error',
        data: {},
        preview: 'Workspace root path is not connected.',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
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
        if (match) targetPath = match.path;
      } catch {
        /* Fallback */
      }
    }

    try {
      const original = await fsPromises.readFile(targetPath, 'utf-8');
      const hasCrlf = original.includes('\r\n');

      // Mode 1: Exact String Replacement (oldText & newText)
      if (typeof oldText === 'string' && typeof newText === 'string') {
        const normOriginal = original.replace(/\r\n/g, '\n');
        const normOld = oldText.replace(/\r\n/g, '\n');
        const normNew = newText.replace(/\r\n/g, '\n');

        if (!normOriginal.includes(normOld)) {
          return {
            status: 'error',
            data: {},
            preview: `Failed to edit "${filename}": target oldText was not found in file.`,
            metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
            error: { code: 'OLD_TEXT_NOT_FOUND', message: 'Target oldText not found in file' },
          };
        }
        const updatedContent = normOriginal.replace(normOld, normNew);
        const finalContent = hasCrlf
          ? updatedContent.replace(/\r?\n/g, '\r\n')
          : updatedContent;
        await fsPromises.writeFile(targetPath, finalContent, 'utf-8');
        return {
          status: 'success',
          data: { path: targetPath, filename, editsApplied: 1 },
          preview: `Successfully edited "${filename}" using string replacement.`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime, filename, editsApplied: 1 },
        };
      }

      // Mode 2: Opencode Diff Patch Engine (patchText)
      if (!patchText || !patchText.trim()) {
        if (typeof content === 'string' && content.trim()) {
          // If model passed full new content into edit tool without patch formatting, write content safely
          const finalContent = hasCrlf ? content.replace(/\r?\n/g, '\r\n') : content;
          await fsPromises.writeFile(targetPath, finalContent, 'utf-8');
          return {
            status: 'success',
            data: { path: targetPath, filename, editsApplied: 1 },
            preview: `Successfully updated content of "${filename}".`,
            metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime, filename, editsApplied: 1 },
          };
        }

        return {
          status: 'error',
          data: {},
          preview: 'Empty patch — provide a valid patch with *** Begin Patch / *** End Patch headers or oldText/newText parameters.',
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

      let currentContent = original.replace(/\r\n/g, '\n');
      let editsApplied = 0;

      for (const hunk of hunks) {
        if (hunk.type === 'update') {
          const update = Patch.derive(hunk, currentContent, filename);
          currentContent = Patch.joinBom(update.content, update.bom);
          editsApplied += hunk.chunks.length;
        }
      }

      const finalContent = hasCrlf ? currentContent.replace(/\r?\n/g, '\r\n') : currentContent;
      await fsPromises.writeFile(targetPath, finalContent, 'utf-8');

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
