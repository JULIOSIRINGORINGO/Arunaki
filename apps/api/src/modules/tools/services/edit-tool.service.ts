import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { FileService } from '../../file/file.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

/**
 * OpenCode-faithful edit tool.
 * Pure oldString → newString replacement with CRLF normalization and BOM handling.
 * No patch engine, no complex modes — exactly how OpenCode does it.
 */

// ── Helpers (ported 1:1 from OpenCode edit.ts) ──────────────────────

const normalizeLineEndings = (text: string) => text.replace(/\r\n/g, '\n');

const detectLineEnding = (text: string): '\n' | '\r\n' =>
  text.includes('\r\n') ? '\r\n' : '\n';

const convertToLineEnding = (text: string, ending: '\n' | '\r\n') =>
  ending === '\n'
    ? normalizeLineEndings(text)
    : normalizeLineEndings(text).replace(/\n/g, '\r\n');

const splitBom = (text: string) =>
  text.startsWith('\uFEFF') ? { bom: true, text: text.slice(1) } : { bom: false, text };

const joinBom = (text: string, bom: boolean) => (bom ? `\uFEFF${text}` : text);

const countOccurrences = (content: string, search: string): number => {
  if (search === '') return content.length + 1;
  let count = 0;
  let offset = 0;
  while ((offset = content.indexOf(search, offset)) !== -1) {
    count++;
    offset += search.length;
  }
  return count;
};

// ── Service ─────────────────────────────────────────────────────────

@Injectable()
export class EditToolService {
  private readonly logger = new Logger(EditToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
  ) {}

  async execute(params: {
    workspaceId: string;
    path: string;
    oldString: string;
    newString: string;
    replaceAll?: boolean;
  }): Promise<ToolResult> {
    const { workspaceId, oldString, newString, replaceAll } = params;
    const filename = params.path;
    const startTime = Date.now();

    // ── Validate input ──────────────────────────────────────────────
    if (!filename) {
      return {
        status: 'error',
        data: {},
        preview: 'Missing required parameter: path',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'MISSING_PATH', message: 'path parameter is required' },
      };
    }

    if (typeof oldString !== 'string' || typeof newString !== 'string') {
      return {
        status: 'error',
        data: {},
        preview: 'Missing required parameters: oldString and newString',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'MISSING_PARAMS', message: 'oldString and newString are required' },
      };
    }

    if (oldString === newString) {
      return {
        status: 'error',
        data: {},
        preview: 'oldString and newString must differ',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'IDENTICAL_STRINGS', message: 'oldString and newString are identical' },
      };
    }

    // ── Resolve workspace root path ─────────────────────────────────
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

    // ── Resolve file path (physical → DB fallback) ──────────────────
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
            f.name.toLowerCase().replace(/\.[^.]+$/, '') === filename.toLowerCase(),
        );
        if (match) {
          targetPath = match.path;
          fileExists = true;
        }
      } catch {
        /* fallback */
      }
    }

    if (!fileExists) {
      return {
        status: 'error',
        data: {},
        preview: `File "${filename}" not found in workspace.`,
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'FILE_NOT_FOUND', message: `File "${filename}" not found` },
      };
    }

    // ── Read, normalize, replace, write ─────────────────────────────
    try {
      const raw = await fsPromises.readFile(targetPath, 'utf-8');
      const lineEnding = detectLineEnding(raw);
      const { bom, text: content } = splitBom(raw);
      const normalized = normalizeLineEndings(content);
      const normOld = normalizeLineEndings(oldString);
      const normNew = normalizeLineEndings(newString);

      const occurrences = countOccurrences(normalized, normOld);

      if (occurrences === 0) {
        return {
          status: 'error',
          data: {},
          preview: `oldString not found in "${filename}". Read the file first and copy the exact text.`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'OLD_STRING_NOT_FOUND', message: 'oldString not found in file content' },
        };
      }

      if (occurrences > 1 && !replaceAll) {
        return {
          status: 'error',
          data: {},
          preview: `oldString appears ${occurrences} times in "${filename}". Use replaceAll: true or provide more context to make it unique.`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'AMBIGUOUS_MATCH', message: `oldString has ${occurrences} occurrences; set replaceAll: true or add context` },
        };
      }

      let updated: string;
      let replacements: number;

      if (replaceAll) {
        updated = normalized.split(normOld).join(normNew);
        replacements = occurrences;
      } else {
        updated = normalized.replace(normOld, normNew);
        replacements = 1;
      }

      const finalContent = joinBom(convertToLineEnding(updated, lineEnding), bom);
      await fsPromises.writeFile(targetPath, finalContent, 'utf-8');

      return {
        status: 'success',
        data: { path: targetPath, filename, replacements },
        preview: `Edited "${filename}" (${replacements} replacement${replacements > 1 ? 's' : ''}).`,
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
          filename,
          replacements,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to edit "${filename}": ${e.message}`,
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'EDIT_FAILED', message: e.message },
      };
    }
  }
}
