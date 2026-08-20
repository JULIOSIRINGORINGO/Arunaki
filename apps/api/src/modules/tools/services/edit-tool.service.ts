import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { FileService } from '../../file/file.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { parse, derive, joinBom } from './apply-patch.js';
import { healPatchText, extractAndApplyFallback } from './patch-healer.js';
import { promises as fsPromises } from 'fs';

@Injectable()
export class EditToolService {
  private readonly logger = new Logger(EditToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FileService))
    private readonly fileService: FileService,
  ) {}

  async execute(params: {
    workspaceId: string;
    patchText?: string;
    path?: string;
    filePath?: string;
    oldString?: string;
    newString?: string;
    replacements?: Array<{ oldString: string; newString: string }>;
    [key: string]: any;
  }): Promise<ToolResult> {
    const rawParams = (params || {}) as Record<string, any>;
    this.logger.log(
      `[edit-tool] RAW PARAMS: ${JSON.stringify(rawParams).slice(0, 500)}`,
    );
    const workspaceId = rawParams.workspaceId;
    let filePath: string =
      rawParams.filePath ||
      rawParams.path ||
      rawParams.filename ||
      rawParams.file ||
      '';
    let patchText: string | undefined =
      rawParams.patchText ??
      rawParams.patch ??
      rawParams.diff ??
      rawParams.patch_text;
    const startTime = Date.now();

    let rootPath: string = rawParams.rootPath || '';
    if (!rootPath) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { rootPath: true },
      });
      rootPath = workspace?.rootPath || '';
    }

    if (!rootPath) {
      return {
        status: 'error',
        data: {},
        preview: 'Workspace root path is not connected.',
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'NO_ROOT_PATH',
          message: 'Workspace root path is not connected',
        },
      };
    }

    if (!filePath) {
      const match = (patchText || '').match(/\*\*\* Update File:\s*(.+)/i);
      if (match && match[1]) {
        filePath = match[1].trim();
      } else {
        return {
          status: 'error',
          data: {},
          preview:
            'Missing path parameter and no *** Update File: directive found in patch text.',
          metadata: {
            toolName: 'edit',
            displayName: 'Edit File',
            executionTime: Date.now() - startTime,
          },
          error: { code: 'MISSING_PARAMS', message: 'filePath is required' },
        };
      }
    }

    // Multi-block replacements array when provided
    const replacementsList = Array.isArray(params.replacements)
      ? params.replacements
      : Array.isArray(params.changes)
        ? params.changes
        : Array.isArray(params.edits)
          ? params.edits
          : null;

    if (replacementsList && replacementsList.length > 0) {
      let targetPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(rootPath, filePath);
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
              f.name.toLowerCase().replace(/\.[^.]+$/, '') ===
                filePath.toLowerCase(),
          );
          if (match) {
            targetPath = match.path;
            fileExists = true;
          }
        } catch {
          /* fallback */
        }
      }

      if (fileExists) {
        let currentContent = await fsPromises.readFile(targetPath, 'utf-8');
        let successCount = 0;
        let searchCursor = 0;
        const stripLineNums = (s: string) =>
          s
            .split('\n')
            .map((l: string) => l.replace(/^\s*\d+:\s*/, ''))
            .join('\n');

        for (const item of replacementsList) {
          const itemOld =
            item.oldString ??
            item.old_str ??
            item.find ??
            item.search ??
            item.target;
          const itemNew =
            item.newString ??
            item.new_str ??
            item.replace ??
            item.replacement ??
            '';
          if (itemOld === undefined) continue;

          // 1. Exact match (prefer from searchCursor)
          let idx = currentContent.indexOf(itemOld, searchCursor);
          if (idx === -1) {
            idx = currentContent.indexOf(itemOld, 0);
          }
          if (idx !== -1) {
            currentContent =
              currentContent.slice(0, idx) +
              itemNew +
              currentContent.slice(idx + itemOld.length);
            searchCursor = idx + itemNew.length;
            successCount++;
            continue;
          }

          // 2. CRLF normalized match
          const normRaw = currentContent.replace(/\r\n/g, '\n');
          const normOld = itemOld.replace(/\r\n/g, '\n');
          const normNew = itemNew.replace(/\r\n/g, '\n');
          let normIdx = normRaw.indexOf(normOld, searchCursor);
          if (normIdx === -1) {
            normIdx = normRaw.indexOf(normOld, 0);
          }
          if (normIdx !== -1) {
            currentContent =
              normRaw.slice(0, normIdx) +
              normNew +
              normRaw.slice(normIdx + normOld.length);
            searchCursor = normIdx + normNew.length;
            successCount++;
            continue;
          }

          // 3. Line-number stripped match
          const strippedOld = stripLineNums(normOld);
          const strippedNew = stripLineNums(normNew);
          if (strippedOld) {
            let sIdx = normRaw.indexOf(strippedOld, searchCursor);
            if (sIdx === -1) {
              sIdx = normRaw.indexOf(strippedOld, 0);
            }
            if (sIdx !== -1) {
              currentContent =
                normRaw.slice(0, sIdx) +
                strippedNew +
                normRaw.slice(sIdx + strippedOld.length);
              searchCursor = sIdx + strippedNew.length;
              successCount++;
              continue;
            }
          }
        }

        if (successCount > 0) {
          await this.createAutoBackup(targetPath, rootPath);
          await fsPromises.writeFile(targetPath, currentContent, 'utf-8');
          return {
            status: 'success',
            data: { files: [filePath], replacements: successCount },
            preview: `Successfully modified ${path.basename(targetPath)} (${successCount} replacement(s) applied and saved to disk).`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
              replacements: successCount,
            },
          };
        } else {
          return {
            status: 'error',
            data: {},
            preview: `Could not match any target replacement chunks in ${path.basename(targetPath)}. Please ensure oldString exactly matches existing text.`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
            },
            error: {
              code: 'NO_MATCH',
              message: 'No replacement matches found',
            },
          };
        }
      }
    }

    // Direct surgical replacement when oldString / newString are provided
    const oldStr =
      rawParams.oldString ??
      rawParams.old_str ??
      rawParams.find ??
      rawParams.search ??
      rawParams.target;
    const newStr =
      rawParams.newString ??
      rawParams.new_str ??
      rawParams.replace ??
      rawParams.replacement;

    if (oldStr !== undefined && newStr !== undefined) {
      let targetPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(rootPath, filePath);
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
              f.name.toLowerCase().replace(/\.[^.]+$/, '') ===
                filePath.toLowerCase(),
          );
          if (match) {
            targetPath = match.path;
            fileExists = true;
          }
        } catch {
          /* fallback */
        }
      }

      if (fileExists) {
        await this.createAutoBackup(targetPath, rootPath);
        const rawContent = await fsPromises.readFile(targetPath, 'utf-8');
        // 1. Try exact match
        if (rawContent.includes(oldStr)) {
          const updated = rawContent.replace(oldStr, newStr);
          await fsPromises.writeFile(targetPath, updated, 'utf-8');
          return {
            status: 'success',
            data: { files: [filePath], replacements: 1 },
            preview: `Successfully modified ${path.basename(targetPath)} (applied and saved to disk).`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
              replacements: 1,
            },
          };
        }

        // 2. Try normalized CRLF match
        const normRaw = rawContent.replace(/\r\n/g, '\n');
        const normOld = oldStr.replace(/\r\n/g, '\n');
        const normNew = newStr.replace(/\r\n/g, '\n');
        if (normRaw.includes(normOld)) {
          const updated = normRaw.replace(normOld, normNew);
          await fsPromises.writeFile(targetPath, updated, 'utf-8');
          return {
            status: 'success',
            data: { files: [filePath], replacements: 1 },
            preview: `Successfully modified ${path.basename(targetPath)} (applied and saved to disk).`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
              replacements: 1,
            },
          };
        }

        // 3. Try stripped line-number prefix match (e.g. "1: REKAPAN..." -> "REKAPAN...")
        const stripLineNums = (s: string) =>
          s
            .split('\n')
            .map((l: string) => l.replace(/^\s*\d+:\s*/, ''))
            .join('\n');
        const strippedOld = stripLineNums(normOld);
        const strippedNew = stripLineNums(normNew);
        if (strippedOld && normRaw.includes(strippedOld)) {
          const updated = normRaw.replace(strippedOld, strippedNew);
          await fsPromises.writeFile(targetPath, updated, 'utf-8');
          return {
            status: 'success',
            data: { files: [filePath], replacements: 1 },
            preview: `Successfully modified ${path.basename(targetPath)} (applied and saved to disk).`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
              replacements: 1,
            },
          };
        }

        // 4. Try whitespace-tolerant line block match
        const rawLines = normRaw.split('\n');
        const oldLines = strippedOld.split('\n');
        const newLines = strippedNew.split('\n');
        const normalize = (l: string) => l.trim().replace(/\s+/g, ' ');
        const normSearch = oldLines.map(normalize);
        let matchIdx = -1;
        if (oldLines.length > 0 && rawLines.length >= oldLines.length) {
          for (let i = 0; i <= rawLines.length - oldLines.length; i++) {
            let matches = true;
            for (let j = 0; j < oldLines.length; j++) {
              if (normalize(rawLines[i + j]) !== normSearch[j]) {
                matches = false;
                break;
              }
            }
            if (matches) {
              matchIdx = i;
              break;
            }
          }
        }
        if (matchIdx !== -1) {
          rawLines.splice(matchIdx, oldLines.length, ...newLines);
          const updated = rawLines.join('\n');
          await fsPromises.writeFile(targetPath, updated, 'utf-8');
          return {
            status: 'success',
            data: { files: [filePath], replacements: 1 },
            preview: `Successfully modified ${path.basename(targetPath)} (applied and saved to disk).`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
              replacements: 1,
            },
          };
        }
      }
    }

    // Auto-convert oldString/newString to patch format if patchText is not provided
    if (!patchText && oldStr) {
      const oldLines = oldStr
        .split(/\r?\n/)
        .map((l: string) => `-${l}`)
        .join('\n');
      const newLines = (newStr || '')
        .split(/\r?\n/)
        .map((l: string) => `+${l}`)
        .join('\n');
      patchText = `@@\n${oldLines}\n${newLines}`;
    }

    if (!patchText) {
      return {
        status: 'error',
        data: {},
        preview:
          'Missing required parameter: patchText (or oldString/newString)',
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'MISSING_PARAMS',
          message: 'patchText or oldString/newString is required',
        },
      };
    }

    const finalPatchText = healPatchText(patchText, filePath);

    let hunks: any[] = [];
    try {
      hunks = parse(finalPatchText);
    } catch (e: any) {
      // If strict parse fails, try direct fallback extraction on the target file
      const targetPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(rootPath, filePath);
      let fileExists = false;
      try {
        await fsPromises.access(targetPath);
        fileExists = true;
      } catch {
        fileExists = false;
      }
      if (fileExists) {
        const rawContent = await fsPromises.readFile(targetPath, 'utf-8');
        const fallbackRes = extractAndApplyFallback(patchText, rawContent);
        if (fallbackRes.success) {
          await fsPromises.writeFile(
            targetPath,
            fallbackRes.updatedContent,
            'utf-8',
          );
          return {
            status: 'success',
            data: { files: [filePath], replacements: fallbackRes.replacements },
            preview: `Successfully applied healed patch to ${path.basename(targetPath)} (${fallbackRes.replacements} replacements).\n\nUpdated content:\n${fallbackRes.updatedContent.slice(0, 1500)}`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
              replacements: fallbackRes.replacements,
            },
          };
        }
      }

      return {
        status: 'error',
        data: {},
        preview: `Failed to parse patch: ${e.message}`,
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'PATCH_PARSE_FAILED', message: e.message },
      };
    }

    if (hunks.length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Patch text contains no hunks.',
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_PATCH', message: 'No valid patch hunks found.' },
      };
    }

    let replacements = 0;
    const filesModified: string[] = [];

    // Dry-run all hunks to ensure they apply cleanly before writing
    const newFileContents = new Map<string, string>();
    for (const hunk of hunks) {
      let targetPath = path.isAbsolute(hunk.path)
        ? hunk.path
        : path.join(rootPath, hunk.path);

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
              f.name.toLowerCase().replace(/\.[^.]+$/, '') ===
                hunk.path.toLowerCase(),
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
          metadata: {
            toolName: 'edit',
            displayName: 'Edit File',
            executionTime: Date.now() - startTime,
          },
          error: {
            code: 'FILE_NOT_FOUND',
            message: `File "${hunk.path}" not found`,
          },
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
          newFileContents.set(
            targetPath,
            joinBom(derived.content, derived.bom),
          );
          replacements += hunk.chunks?.length || 0;
          filesModified.push(hunk.path);
        }
      } catch (e: any) {
        // Fallback for smaller models: try relaxed direct search & replace on each chunk!
        let relaxedSuccess = false;
        if (hunk.type === 'update' && hunk.chunks && hunk.chunks.length > 0) {
          let modified = originalContent;
          let appliedCount = 0;
          for (const chunk of hunk.chunks) {
            const oldStr = chunk.oldLines.join('\n');
            const newStr = chunk.newLines.join('\n');
            if (!oldStr) continue;

            // 1. Try raw replacement
            if (modified.includes(oldStr)) {
              modified = modified.replace(oldStr, newStr);
              appliedCount++;
            } else {
              // 2. Try normalized CRLF replacement
              const normMod = modified.replace(/\r\n/g, '\n');
              const normOld = oldStr.replace(/\r\n/g, '\n');
              const normNew = newStr.replace(/\r\n/g, '\n');
              if (normMod.includes(normOld)) {
                modified = normMod.replace(normOld, normNew);
                appliedCount++;
              } else {
                // 3. Try stripped line-numbers replacement
                const stripL = (s: string) =>
                  s
                    .split('\n')
                    .map((l) => l.replace(/^\s*\d+:\s*/, ''))
                    .join('\n');
                const sOld = stripL(normOld);
                const sNew = stripL(normNew);
                if (sOld && normMod.includes(sOld)) {
                  modified = normMod.replace(sOld, sNew);
                  appliedCount++;
                }
              }
            }
          }
          if (appliedCount > 0) {
            newFileContents.set(targetPath, modified);
            replacements += appliedCount;
            filesModified.push(hunk.path);
            relaxedSuccess = true;
          }
        }

        if (!relaxedSuccess) {
          const fallbackRes = extractAndApplyFallback(
            finalPatchText,
            originalContent,
          );
          if (fallbackRes.success && fallbackRes.replacements > 0) {
            newFileContents.set(targetPath, fallbackRes.updatedContent);
            replacements += fallbackRes.replacements;
            filesModified.push(hunk.path);
            relaxedSuccess = true;
          }
        }

        if (!relaxedSuccess) {
          return {
            status: 'error',
            data: {},
            preview: `Patch failed to apply cleanly to "${hunk.path}": ${e.message}\n\nCurrent content of "${hunk.path}" is:\n${originalContent}`,
            metadata: {
              toolName: 'edit',
              displayName: 'Edit File',
              executionTime: Date.now() - startTime,
            },
            error: { code: 'PATCH_APPLY_FAILED', message: e.message },
          };
        }
      }
    }

    // Apply writes
    try {
      for (const [targetPath, content] of newFileContents.entries()) {
        if (content === null) {
          await fsPromises.unlink(targetPath);
        } else {
          await this.createAutoBackup(targetPath, rootPath);
          await fsPromises.writeFile(targetPath, content, 'utf-8');
        }
      }
      return {
        status: 'success',
        data: { files: filesModified, replacements },
        preview: `Successfully modified ${filesModified.map((f) => path.basename(f)).join(', ')} (${replacements} replacement(s) applied and saved to disk).`,
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
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'WRITE_FAILED', message: e.message },
      };
    }
  }

  private async createAutoBackup(
    targetPath: string,
    rootPath: string,
  ): Promise<void> {
    try {
      if (!rootPath || !targetPath) return;
      const backupDir = path.join(rootPath, '.arunaki', 'backups');
      await fsPromises.mkdir(backupDir, { recursive: true });
      const filename = path.basename(targetPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${filename}.${timestamp}.bak`);
      await fsPromises.copyFile(targetPath, backupPath);
      this.logger.log(`[edit-tool] Auto-backup created: ${backupPath}`);
    } catch (err: any) {
      this.logger.warn(`[edit-tool] Auto-backup failed: ${err.message}`);
    }
  }
}
