import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { FileService } from '../../file/file.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { parse, derive, joinBom } from './apply-patch.js';
import { promises as fsPromises } from 'fs';

@Injectable()
export class EditToolService {
  private readonly logger = new Logger(EditToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
  ) {}

  async execute(params: {
    workspaceId: string;
    patchText?: string;
    path?: string;
    filePath?: string;
    oldString?: string;
    newString?: string;
    [key: string]: any;
  }): Promise<ToolResult> {
    let { workspaceId, patchText, path: filePath, filePath: altPath } = params;
    filePath = filePath || altPath || params.filename || '';
    const startTime = Date.now();

    // Auto-convert oldString/newString to patch format if patchText is not provided
    if (!patchText && (params.oldString || params.old_str || params.find)) {
      const oldStr = params.oldString || params.old_str || params.find || '';
      const newStr = params.newString || params.new_str || params.replace || '';
      const oldLines = oldStr.split(/\r?\n/).map((l: string) => `-${l}`).join('\n');
      const newLines = newStr.split(/\r?\n/).map((l: string) => `+${l}`).join('\n');
      patchText = `@@\n${oldLines}\n${newLines}`;
    }

    if (!patchText) {
      return {
        status: 'error',
        data: {},
        preview: 'Missing required parameter: patchText (or oldString/newString)',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'MISSING_PARAMS', message: 'patchText or oldString/newString is required' },
      };
    }
    
    if (!filePath) {
      const match = patchText.match(/\*\*\* Update File:\s*(.+)/i);
      if (match && match[1]) {
        filePath = match[1].trim();
      } else {
        return {
          status: 'error',
          data: {},
          preview: 'Missing path parameter and no *** Update File: directive found in patch text.',
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'MISSING_PARAMS', message: 'path is required' },
        };
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
    
    let finalPatchText = patchText.trim();
    
    // Bulletproof normalization: strip any LLM hallucinated headers and ensure standard structure
    finalPatchText = finalPatchText.replace(/^\*\*\* Begin Patch\r?\n/i, '');
    finalPatchText = finalPatchText.replace(/^\*\*\* Delete File:.*?\r?\n/i, '');
    finalPatchText = finalPatchText.replace(/^\*\*\* Update File:.*?\r?\n/i, '');
    finalPatchText = finalPatchText.replace(/^@@\r?\n/i, '');
    finalPatchText = finalPatchText.replace(/^\*\*\* End Patch\r?\n?/i, '');
    
    finalPatchText = `*** Begin Patch\n*** Update File: ${filePath}\n@@\n${finalPatchText.trim()}\n*** End Patch`;

    let hunks;
    
    try {
      hunks = parse(finalPatchText);
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to parse patch: ${e.message}`,
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'PATCH_PARSE_FAILED', message: e.message },
      };
    }
    
    if (hunks.length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Patch text contains no hunks.',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'EMPTY_PATCH', message: 'No valid patch hunks found.' },
      };
    }

    let replacements = 0;
    const filesModified: string[] = [];

    // Dry-run all hunks to ensure they apply cleanly before writing
    const newFileContents = new Map<string, string>();
    for (const hunk of hunks) {
      let targetPath = path.isAbsolute(hunk.path) ? hunk.path : path.join(rootPath, hunk.path);

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
              f.name.toLowerCase() === hunk.path.toLowerCase() ||
              f.name.toLowerCase().replace(/\.[^.]+$/, '') === hunk.path.toLowerCase(),
          );
          if (match) {
            targetPath = match.path;
            fileExists = true;
          }
        } catch {
          /* fallback */
        }
      }

      if (!fileExists && hunk.type !== 'add') {
         return {
          status: 'error',
          data: {},
          preview: `File "${hunk.path}" not found in workspace for patch.`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'FILE_NOT_FOUND', message: `File "${hunk.path}" not found` },
        };
      }
      
      let originalContent = '';
      if (fileExists && hunk.type !== 'add') {
        originalContent = await fsPromises.readFile(targetPath, 'utf-8');
      }
      
      try {
        if (hunk.type === 'add') {
           newFileContents.set(targetPath, hunk.contents);
           replacements += 1;
           filesModified.push(hunk.path);
        } else if (hunk.type === 'delete') {
           newFileContents.set(targetPath, null as any); // mark for deletion
           replacements += 1;
           filesModified.push(hunk.path);
        } else {
           const derived = derive(hunk, originalContent, hunk.path);
           newFileContents.set(targetPath, joinBom(derived.content, derived.bom));
           replacements += hunk.chunks?.length || 0;
           filesModified.push(hunk.path);
        }
      } catch (e: any) {
        return {
          status: 'error',
          data: {},
          preview: `Patch failed to apply cleanly to "${hunk.path}": ${e.message}`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'PATCH_APPLY_FAILED', message: e.message },
        };
      }
    }

    // Apply writes
    try {
      for (const [targetPath, content] of newFileContents.entries()) {
        if (content === null) {
          await fsPromises.unlink(targetPath);
        } else {
          await fsPromises.writeFile(targetPath, content, 'utf-8');
        }
      }
      return {
        status: 'success',
        data: { files: filesModified, replacements },
        preview: `Successfully applied patch to ${filesModified.length} file(s) with ${replacements} replacement(s).`,
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
          replacements,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to write patch: ${e.message}`,
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'WRITE_FAILED', message: e.message },
      };
    }
  }
}
