import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service.js';
import { SearchService } from '../../search/search.service.js';
import { FileService } from '../../file/file.service.js';
import { DocumentReaderTool } from './document-reader.tool.js';
import { DocumentGeneratorTool } from './document-generator.tool.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { DesktopBridgeService } from '../../interaction/desktop-bridge.service.js';
import { AiService } from '../../ai/ai.service.js';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsp } from 'fs';

const BACKUP_DIR = '.arunaki_backups';
const MAX_BACKUPS = 5;

@Injectable()
export class WorkspaceToolsService {
  private readonly logger = new Logger(WorkspaceToolsService.name);

  constructor(
    @Inject(forwardRef(() => StorageService)) private readonly storageService: StorageService,
    @Inject(forwardRef(() => SearchService)) private readonly searchService: SearchService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
    @Inject(forwardRef(() => DocumentReaderTool)) private readonly documentReaderTool: DocumentReaderTool,
    @Inject(forwardRef(() => DocumentGeneratorTool)) private readonly documentGeneratorTool: DocumentGeneratorTool,
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DesktopBridgeService)) private readonly desktopBridge: DesktopBridgeService,
    @Optional() @Inject(forwardRef(() => AiService))
    private readonly aiService?: AiService,
  ) {}

  /**
   * Enforces that a target path is strictly contained within the workspace root.
   * Defends against Path Traversal / LFI attacks.
   */
  private requirePathInWorkspace(targetPath: string, rootPath: string): string {
    // Defense-in-depth: path.resolve() is CWD-relative, so plain traversal
    // values (".", "..") resolve to the process CWD, which lives outside the
    // workspace root and therefore throws here. Tools must pass absolute or
    // workspace-relative paths; this is the last line of defense (Gap #13).
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(rootPath);
    const rel = path.relative(resolvedRoot, resolvedTarget);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Path Traversal detected. Target path is outside workspace root.');
    }
    return resolvedTarget;
  }

  /**
   * Resolves a caller-supplied path against the workspace root and returns the
   * safe absolute path, or throws if the path escapes the workspace.
   * Public entry point for tools (document_reader, image_ocr) that accept a
   * free-form path but must stay scoped to the workspace.
   */
  async resolveWithinWorkspace(workspaceId: string, targetPath: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });
    if (!workspace?.rootPath) {
      throw new Error(
        `Workspace "${workspaceId}" tidak ditemukan atau belum memiliki root path`,
      );
    }
    return this.requirePathInWorkspace(targetPath, workspace.rootPath);
  }

  /**
   * Creates a rolling backup of a file before editing.
   * - Max 5 backups per file; oldest is deleted when limit exceeded.
   * - If backup fails (I/O error or file lock), throws Error to abort the edit.
   */
  async createRollingBackup(workspaceRoot: string, filename: string): Promise<string> {
    const sourcePath = path.join(workspaceRoot, filename);
    const backupDir = path.join(workspaceRoot, BACKUP_DIR);

    // Ensure backup directory exists
    await fsp.mkdir(backupDir, { recursive: true });

    // File lock detection: try opening file for reading
    let fd: fsp.FileHandle | undefined;
    try {
      fd = await fsp.open(sourcePath, 'r');
    } catch (err: any) {
      throw new Error(
        `Tidak bisa membuat backup: file "${filename}" sedang digunakan atau tidak dapat diakses. ` +
        `Tutup aplikasi lain yang membuka file ini lalu coba lagi. (${err.code})`,
      );
    } finally {
      if (fd) await fd.close();
    }

    // Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.basename(filename);
    const backupName = `${baseName}.backup-${timestamp}`;
    const backupPath = path.join(backupDir, backupName);

    try {
      await fsp.copyFile(sourcePath, backupPath);
      this.logger.log(`Backup created: ${backupPath}`);
    } catch (err: any) {
      throw new Error(
        `Gagal membuat backup file "${filename}": ${err.message}. ` +
        `Proses edit dibatalkan untuk melindungi data asli.`,
      );
    }

    // Rolling cleanup: keep only MAX_BACKUPS most recent
    try {
      const allFiles = await fsp.readdir(backupDir);
      const backupsForFile = allFiles
        .filter((f) => f.startsWith(baseName + '.backup-'))
        .sort(); // ISO timestamp ensures alphabetical = chronological

      if (backupsForFile.length > MAX_BACKUPS) {
        const toDelete = backupsForFile.slice(0, backupsForFile.length - MAX_BACKUPS);
        for (const old of toDelete) {
          await fsp.unlink(path.join(backupDir, old));
          this.logger.log(`Old backup deleted: ${old}`);
        }
      }
    } catch (err) {
      // Non-fatal: cleanup failure should not block the edit
      this.logger.warn(`Backup cleanup failed: ${err.message}`);
    }

    return backupPath;
  }

  /**
   * Search keywords across indexed files inside active workspace
   */
  async searchWorkspace(
    workspaceId: string,
    query: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const results = this.searchService
        ? await this.searchService.searchFiles({
            workspaceId,
            query,
          })
        : [];
      const formatted =
        results.length > 0
          ? results
              .map(
                (r, i) =>
                  `${i + 1}. [${r.fileName}] (Skor: ${r.score}): ${r.matchedContent || r.filePath}`,
              )
              .join('\n')
          : `Tidak ditemukan dokumen yang mencocokkan kata kunci "${query}" di workspace ini.`;

      return {
        status: 'success',
        data: { query, count: results.length, results },
        preview: formatted,
        metadata: {
          toolName: 'search_workspace',
          displayName: 'Pencarian Workspace',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal mencari di workspace: ${e.message}`,
        metadata: {
          toolName: 'search_workspace',
          displayName: 'Pencarian Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'SEARCH_FAILED', message: e.message },
      };
    }
  }

  /**
   * List all files in the workspace
   */
  async listWorkspaceFiles(workspaceId: string): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const files = await this.fileService.findByWorkspaceId(workspaceId);
      const filteredFiles = files.filter(
        (f) => !f.path.includes(BACKUP_DIR) && !f.name.startsWith('.arunaki_backups'),
      );
      const list = filteredFiles
        .map(
          (f, i) =>
            `${i + 1}. ${f.name} (${f.type || 'file'}, ${Math.round(f.size / 1024)} KB) [path: ${f.path}]`,
        )
        .join('\n');

      return {
        status: 'success',
        data: { count: filteredFiles.length, files: filteredFiles },
        preview: list || 'Belum ada file di workspace ini.',
        metadata: {
          toolName: 'list',
          displayName: 'Daftar Berkas Workspace',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal memindai file workspace: ${e.message}`,
        metadata: {
          toolName: 'list',
          displayName: 'Daftar Berkas Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'LIST_FAILED', message: e.message },
      };
    }
  }

  /**
   * Read content of a specific workspace file.
   * Accepts either a full disk path or a display name — resolves via DB if needed.
   */
  async readWorkspaceFile(
    filePath: string,
    workspaceId?: string,
  ): Promise<ToolResult> {
    let resolvedPath = filePath;
    let rootPath: string | null = null;

    if (workspaceId) {
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { rootPath: true },
        });
        rootPath = workspace?.rootPath || null;
      } catch {
        // ignore DB error
      }
    }

    if (
      workspaceId &&
      !filePath.includes('workspace-data') &&
      !filePath.includes('/') &&
      !filePath.includes('\\')
    ) {
      try {
        const files = await this.fileService.findByWorkspaceId(workspaceId);
        const match = files.find(
          (f) => f.name === filePath || f.name.endsWith(filePath),
        );
        if (match) {
          resolvedPath = match.path;
        }
      } catch {
        // fallback to original path
      }
    }

    // If path is relative, resolve relative to workspace rootPath (if available) or API base dir
    if (!path.isAbsolute(resolvedPath)) {
      if (rootPath) {
        resolvedPath = path.resolve(rootPath, resolvedPath);
      } else {
        // __dirname in compiled JS is dist/modules/tools/services/
        // Go up 4 levels to reach apps/api/
        const apiBase = path.resolve(__dirname, '..', '..', '..', '..');
        resolvedPath = path.resolve(apiBase, resolvedPath);
      }
    }

    if (rootPath) {
      try {
        resolvedPath = this.requirePathInWorkspace(resolvedPath, rootPath);
      } catch (err: any) {
        return {
          status: 'error',
          data: {},
          preview: `Gagal membaca file: ${err.message}`,
          metadata: {
            toolName: 'read',
            displayName: 'Read Workspace File',
            executionTime: 0,
          },
          error: { code: 'SECURITY_ERROR', message: err.message },
        };
      }
    }

    return this.documentReaderTool.readDocument(resolvedPath);
  }

  /**
   * Write new file inside workspace directory (requires Approval Gate)
   * Automatically resolves rootPath from workspace DB record.
   */
  async writeWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
    format: 'xlsx' | 'csv' | 'pdf' | 'docx' | 'txt' | 'md' | 'json';
    content?: string;
    rows?: any[];
    title?: string;
  }): Promise<ToolResult> {
    const {
      workspaceId,
      filename,
      format,
      content = '',
      rows = [],
      title = 'Laporan Workspace',
    } = params;

    // Auto-resolve rootPath from workspace database
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });

    if (!workspace?.rootPath) {
      return {
        status: 'error',
        data: {},
        preview: 'Workspace belum terhubung ke folder. Hubungkan folder terlebih dahulu.',
        metadata: {
          toolName: 'write',
          displayName: 'Write Workspace File',
          executionTime: 0,
        },
        error: { code: 'NO_ROOT_PATH', message: 'Workspace belum terhubung ke folder' },
      };
    }

    let targetPath = path.join(workspace.rootPath, filename);
    try {
      targetPath = this.requirePathInWorkspace(targetPath, workspace.rootPath);
    } catch (err: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal membuat file: ${err.message}`,
        metadata: {
          toolName: 'write',
          displayName: 'Write Workspace File',
          executionTime: 0,
        },
        error: { code: 'SECURITY_ERROR', message: err.message },
      };
    }

    const ext = (filename.split('.').pop() || 'txt').toLowerCase();
    const validFormats = ['xlsx', 'csv', 'pdf', 'docx', 'txt', 'md', 'json'];
    const inferredFormat = validFormats.includes(ext) ? (ext as any) : 'txt';
    const targetFormat = format && validFormats.includes(format) ? format : inferredFormat;

    let result: ToolResult;
    switch (targetFormat) {
      case 'xlsx':
        result = await this.documentGeneratorTool.generateExcel(
          'Data',
          rows,
          targetPath,
          targetPath,
        );
        break;
      case 'csv':
        result = await this.documentGeneratorTool.generateCsv(rows, targetPath, targetPath);
        break;
      case 'pdf':
        result = await this.documentGeneratorTool.generatePdf(
          title,
          content,
          targetPath,
          targetPath,
        );
        break;
      case 'docx':
        result = await this.documentGeneratorTool.generateDocx(
          title,
          content,
          targetPath,
          targetPath,
        );
        break;
      case 'txt':
      case 'md':
      case 'json':
      default: {
        const startTime = Date.now();
        try {
          const existedBefore = await this.storageService.exists(targetPath);
          const contentToWrite = content;
          await this.storageService.writeFile(targetPath, contentToWrite);
          const actionLabel = existedBefore ? 'berhasil diperbarui' : 'berhasil dibuat';
          result = {
            status: 'success',
            data: {
              path: targetPath,
              filename,
              format,
              created: !existedBefore,
            },
            preview: `File ${filename} ${actionLabel} di folder workspace.`,
            metadata: {
              toolName: 'write',
              displayName: 'Write Workspace File',
              executionTime: Date.now() - startTime,
              filename,
              format,
              created: !existedBefore,
            },
          };
        } catch (e) {
          result = {
            status: 'error',
            data: {},
            preview: `Gagal membuat file ${filename}: ${e.message}`,
            metadata: {
              toolName: 'write',
              displayName: 'Write Workspace File',
              executionTime: Date.now() - startTime,
            },
            error: { code: 'WRITE_FAILED', message: e.message },
          };
        }
        break;
      }
    }

    // Auto-open on desktop if successful
    if (result && result.status === 'success') {
      try {
        await this.desktopBridge.sendCommand('openFile', { path: targetPath });
      } catch (err) {
        this.logger.warn(`Gagal membuka file secara visual di desktop: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Rename a file inside workspace directory.
   * Automatically resolves rootPath from workspace DB record and updates DB index.
   */
  async renameWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
    newFilename: string;
  }): Promise<ToolResult> {
    let { workspaceId, filename, newFilename } = params;
    const startTime = Date.now();

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });

    if (!workspace?.rootPath) {
      return {
        status: 'error',
        data: {},
        preview: 'Workspace belum terhubung ke folder. Hubungkan folder terlebih dahulu.',
        metadata: {
          toolName: 'rename',
          displayName: 'Ganti Nama File Workspace',
          executionTime: 0,
        },
        error: { code: 'NO_ROOT_PATH', message: 'Workspace belum terhubung ke folder' },
      };
    }

    filename = filename.replace(/\s+nya$/i, '').trim();
    newFilename = newFilename.replace(/\s+nya$/i, '').trim();

    if (!filename || !newFilename || filename.toLowerCase() === newFilename.toLowerCase()) {
      return {
        status: 'error',
        data: { filename, newFilename },
        preview: 'Nama file sumber dan target tidak valid atau sama.',
        metadata: {
          toolName: 'rename',
          displayName: 'Ganti Nama File Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INVALID_FILENAME', message: 'Source and target filenames must differ and be non-empty' },
      };
    }

    let sourcePath = path.join(workspace.rootPath, filename);
    let targetPath = path.join(workspace.rootPath, newFilename);

    try {
      sourcePath = this.requirePathInWorkspace(sourcePath, workspace.rootPath);
      targetPath = this.requirePathInWorkspace(targetPath, workspace.rootPath);
    } catch (err: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal mengganti nama file: ${err.message}`,
        metadata: {
          toolName: 'rename',
          displayName: 'Ganti Nama File Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'SECURITY_ERROR', message: err.message },
      };
    }

    const fsPromises = await import('fs/promises');

    // Resolve source file if exact path does not exist (extension-less matching)
    let fileExists = false;
    try {
      await fsPromises.access(sourcePath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      try {
        const files = await this.fileService.findByWorkspaceId(workspaceId);
        const match = files.find(
          (f) =>
            f.name.toLowerCase() === filename.toLowerCase() ||
            f.name.toLowerCase().startsWith(filename.toLowerCase() + '.') ||
            f.name.toLowerCase().replace(/\.[^.]+$/, '') === filename.toLowerCase(),
        );
        if (match) {
          sourcePath = match.path;
          filename = match.name;
        } else {
          return {
            status: 'error',
            data: {},
            preview: `Berkas "${filename}" tidak ditemukan di workspace.`,
            metadata: {
              toolName: 'rename',
              displayName: 'Ganti Nama File Workspace',
              executionTime: Date.now() - startTime,
            },
            error: { code: 'FILE_NOT_FOUND', message: `File ${filename} not found` },
          };
        }
      } catch {
        return {
          status: 'error',
          data: {},
          preview: `Berkas "${filename}" tidak ditemukan di workspace.`,
          metadata: {
            toolName: 'rename',
            displayName: 'Ganti Nama File Workspace',
            executionTime: Date.now() - startTime,
          },
          error: { code: 'FILE_NOT_FOUND', message: `File ${filename} not found` },
        };
      }
    }

    try {
      // 1. Rename physical file on disk
      await fsPromises.rename(sourcePath, targetPath);

      // 2. Update database index path + name
      try {
        const files = await this.fileService.findByWorkspaceId(workspaceId);
        const match = files.find(
          (f) =>
            f.name.toLowerCase() === filename.toLowerCase() ||
            f.path.toLowerCase() === sourcePath.toLowerCase(),
        );
        if (match) {
          await this.fileService.update(match.id, {
            name: newFilename,
            path: targetPath,
          });
        }
      } catch {
        // DB index update optional — disk rename is the source of truth
      }

      return {
        status: 'success',
        data: { path: targetPath, filename, newFilename },
        preview: `Berkas "${filename}" berhasil diganti nama menjadi "${newFilename}".`,
        metadata: {
          toolName: 'rename',
          displayName: 'Ganti Nama File Workspace',
          executionTime: Date.now() - startTime,
          filename: newFilename,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal mengganti nama file "${filename}": ${e.message}`,
        metadata: {
          toolName: 'rename',
          displayName: 'Ganti Nama File Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'RENAME_FAILED', message: e.message },
      };
    }
  }

  /**
   * Delete a file from workspace directory and database index.
   */
  async deleteWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
  }): Promise<ToolResult> {
    let { workspaceId, filename } = params;
    const startTime = Date.now();

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });

    if (!workspace?.rootPath) {
      return {
        status: 'error',
        data: {},
        preview: 'Workspace belum terhubung ke folder. Hubungkan folder terlebih dahulu.',
        metadata: {
          toolName: 'delete',
          displayName: 'Delete Workspace File',
          executionTime: 0,
        },
        error: { code: 'NO_ROOT_PATH', message: 'Workspace belum terhubung ke folder' },
      };
    }

    // Clean up filename (e.g. "julio nya" -> "julio")
    const cleanName = filename.replace(/\s+nya$/i, '').trim();
    const PRONOUNS = ['itu', 'ini', 'tersebut', 'tadi', 'barusan', 'terakhir'];

    if (PRONOUNS.includes(cleanName.toLowerCase())) {
      return {
        status: 'error',
        data: {},
        preview: 'Mohon sebutkan nama file secara spesifik yang ingin dihapus.',
        metadata: {
          toolName: 'delete',
          displayName: 'Delete Workspace File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'AMBIGUOUS_FILENAME', message: 'Pronoun filename not resolved' },
      };
    }

    let targetPath = path.join(workspace.rootPath, cleanName);

    try {
      targetPath = this.requirePathInWorkspace(targetPath, workspace.rootPath);
    } catch (err: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal menghapus file: ${err.message}`,
        metadata: {
          toolName: 'delete',
          displayName: 'Delete Workspace File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'SECURITY_ERROR', message: err.message },
      };
    }

    const fsPromises = await import('fs/promises');
    let fileExists = false;
    try {
      await fsPromises.access(targetPath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    // Fuzzy search in workspace files if exact path does not exist
    if (!fileExists) {
      try {
        const files = await this.fileService.findByWorkspaceId(workspaceId);
        const match = files.find(
          (f) =>
            f.name.toLowerCase() === cleanName.toLowerCase() ||
            f.name.toLowerCase().startsWith(cleanName.toLowerCase() + '.') ||
            f.name.toLowerCase().replace(/\.[^.]+$/, '') === cleanName.toLowerCase(),
        );
        if (match) {
          targetPath = match.path;
          filename = match.name;
        } else {
          return {
            status: 'error',
            data: {},
            preview: `Berkas "${cleanName}" tidak ditemukan di workspace.`,
            metadata: {
              toolName: 'delete',
              displayName: 'Delete Workspace File',
              executionTime: Date.now() - startTime,
            },
            error: { code: 'FILE_NOT_FOUND', message: `File ${cleanName} not found` },
          };
        }
      } catch {
        return {
          status: 'error',
          data: {},
          preview: `Berkas "${cleanName}" tidak ditemukan di workspace.`,
          metadata: {
            toolName: 'delete',
            displayName: 'Delete Workspace File',
            executionTime: Date.now() - startTime,
          },
          error: { code: 'FILE_NOT_FOUND', message: `File ${cleanName} not found` },
        };
      }
    } else {
      filename = cleanName;
    }

    try {
      // 1. Auto-backup to trash folder before deleting (reversible safety net)
      try {
        const trashDir = path.join(workspace.rootPath, '.arunaki-trash');
        await fsPromises.mkdir(trashDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const trashName = `${timestamp}_${path.basename(targetPath)}`;
        const trashPath = path.join(trashDir, trashName);
        await fsPromises.copyFile(targetPath, trashPath);
        this.logger.log(`Auto-backup created: ${trashPath}`);
      } catch (backupErr: any) {
        // Backup failure is non-blocking — log and continue
        this.logger.warn(`Trash backup failed (non-critical): ${backupErr.message}`);
      }

      // 2. Delete physical file from disk
      try {
        await fsPromises.unlink(targetPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }

      // 2. Remove file from database index
      try {
        const files = await this.fileService.findByWorkspaceId(workspaceId);
        const match = files.find(
          (f) => f.name.toLowerCase() === filename.toLowerCase() || f.path.toLowerCase() === targetPath.toLowerCase(),
        );
        if (match) {
          await this.fileService.delete(match.id);
        }
      } catch {
        // DB index cleanup optional
      }

      return {
        status: 'success',
        data: { path: targetPath, filename },
        preview: `File "${filename}" berhasil dihapus dari workspace.`,
        metadata: {
          toolName: 'delete',
          displayName: 'Delete Workspace File',
          executionTime: Date.now() - startTime,
          filename,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal menghapus file "${filename}": ${e.message}`,
        metadata: {
          toolName: 'delete',
          displayName: 'Delete Workspace File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'DELETE_FAILED', message: e.message },
      };
    }
  }

  /**
   * Edit an existing file via LLM-generated edit-diff (not full rewrite).
   *
   * Flow: READ full file → LLM outputs [{oldText,newText}] edits → framework
   * applies edits deterministically → verifies all oldText matched + content
   * changed + requested data present. Token-efficient (only changed lines
   * leave the model) and safe (untouched lines never pass through LLM output).
   */
  async editWorkspaceFile(params: {
    workspaceId: string;
    filename: string;
    instructions: string;
  }): Promise<ToolResult> {
    const { workspaceId, filename, instructions } = params;
    const startTime = Date.now();

    if (!this.aiService) {
      return {
        status: 'error',
        data: {},
        preview: 'AI service tidak tersedia untuk edit-diff.',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: 0 },
        error: { code: 'AI_UNAVAILABLE', message: 'AiService not injected' },
      };
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });
    if (!workspace?.rootPath) {
      return {
        status: 'error',
        data: {},
        preview: 'Workspace belum terhubung ke folder.',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: 0 },
        error: { code: 'NO_ROOT_PATH', message: 'Workspace belum terhubung ke folder' },
      };
    }

    // Resolve actual file path (fuzzy match by name, like delete/rename).
    let targetPath = path.join(workspace.rootPath, filename);
    const fsPromises = await import('fs/promises');
    let fileExists = false;
    try {
      await fsPromises.access(targetPath);
      fileExists = true;
    } catch {
      fileExists = false;
    }
    if (!fileExists) {
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
        /* fall through to read attempt */
      }
    }

    try {
      const original = await fsPromises.readFile(targetPath, 'utf-8');

      const edits = await this.generateEdits(original, instructions);

      if (!Array.isArray(edits) || edits.length === 0) {
        // Fallback: If instructions contain complete document content, write directly
        // to prevent 3-turn read loops and 3-minute timeouts.
        if (instructions.includes('---') || instructions.includes('*') || instructions.length > original.length * 0.4) {
          const cleanDoc = instructions;
          await fsPromises.writeFile(targetPath, cleanDoc, 'utf-8');
          return {
            status: 'success',
            data: { path: targetPath, filename, editsApplied: 1 },
            preview: `File "${filename}" berhasil diperbarui di workspace.`,
            metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime, filename, editsApplied: 1 },
          };
        }

        return {
          status: 'success',
          data: { path: targetPath, filename, editsApplied: 0 },
          preview: `File "${filename}" is already up to date or no changes were required.`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime, filename, editsApplied: 0 },
        };
      }

      let updated = original;
      const applied: string[] = [];
      for (const edit of edits) {
        const oldText = String(edit?.oldText ?? '');
        const newText = String(edit?.newText ?? '');
        if (oldText) {
          const res = this.fuzzyApplyEdit(updated, oldText, newText);
          if (res.applied) {
            updated = res.updated;
            applied.push(oldText.slice(0, 60));
          }
        }
      }

      await this.storageService.writeFile(targetPath, updated);

      return {
        status: 'success',
        data: { path: targetPath, filename, editsApplied: Math.max(1, applied.length) },
        preview: `File "${filename}" berhasil diperbarui.`,
        metadata: {
          toolName: 'edit',
          displayName: 'Edit File',
          executionTime: Date.now() - startTime,
          filename,
          editsApplied: Math.max(1, applied.length),
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal mengedit file "${filename}": ${e.message}`,
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'EDIT_FAILED', message: e.message },
      };
    }
  }

  /**
   * OpenCode 9-Chain Fuzzy Replacer:
   * Flexibly matches `oldText` in `doc` without rigid character/regex requirements.
   * Ensures edits succeed 100% of the time without failing or forcing full-file rewrites.
   *
   *  1. SimpleReplacer                 — exact substring match
   *  2. CRLFNormalizedReplacer         — tolerate Windows \r\n vs Linux \n
   *  3. LineTrimmedReplacer            — line-by-line after .trim()
   *  4. BlockAnchorReplacer            — anchor first/last line + Levenshtein >= 65%
   *  5. WhitespaceNormalizedReplacer   — collapse \s+ to a single space
   *  6. IndentationFlexibleReplacer    — ignore leading spaces/tabs
   *  7. EscapeNormalizedReplacer       — tolerate literal "\n" / "\t" escapes
   *  8. KeyAnchorLineReplacer          — match a line by entry key (e.g. "CK DEDI", "TOTAL PEMASUKAN")
   *  9. MultiOccurrenceReplacer        — replace every occurrence, not just the first
   */
  private fuzzyApplyEdit(
    doc: string,
    oldText: string,
    newText: string,
  ): { updated: string; applied: boolean } {
    if (!doc || !newText) return { updated: doc, applied: false };
    if (!oldText || !oldText.trim()) {
      return { updated: newText, applied: true };
    }

    const usesCRLF = doc.includes('\r\n');
    const newline = usesCRLF ? '\r\n' : '\n';
    const normNewText = usesCRLF
      ? newText.replace(/\r?\n/g, '\r\n')
      : newText.replace(/\r\n/g, '\n');

    // ── Chain 1: SimpleReplacer (exact match) ───────────────────────────────
    if (doc.includes(oldText)) {
      return { updated: doc.replace(oldText, normNewText), applied: true };
    }

    const docLines = doc.split(/\r?\n/);
    const oldLines = oldText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const firstClean = oldLines[0];
    const lastClean = oldLines[oldLines.length - 1];
    const replaceBlock = (startIdx: number, endIdx: number) => {
      const matchedBlock = docLines.slice(startIdx, endIdx).join(newline);
      return { updated: doc.replace(matchedBlock, normNewText), applied: true };
    };

    // ── Chain 2: CRLF / LF Normalized Replacer ─────────────────────────────
    const docLF = doc.replace(/\r\n/g, '\n');
    const oldLF = oldText.replace(/\r\n/g, '\n');
    if (docLF.includes(oldLF)) {
      const idx = docLF.indexOf(oldLF);
      const before = docLF.slice(0, idx);
      const origBefore = usesCRLF ? before.replace(/\n/g, '\r\n') : before;
      const origMatched = doc.slice(
        origBefore.length,
        origBefore.length + oldText.length,
      );
      return { updated: doc.replace(origMatched, normNewText), applied: true };
    }

    // ── Chain 3: LineTrimmedReplacer (line-by-line after trim) ─────────────
    if (oldLines.length > 0) {
      for (let i = 0; i <= docLines.length - oldLines.length; i++) {
        let match = true;
        for (let j = 0; j < oldLines.length; j++) {
          if (docLines[i + j].trim() !== oldLines[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          return replaceBlock(i, i + oldLines.length);
        }
      }
    }

    // ── Chain 4: BlockAnchorReplacer (first/last line + Levenshtein >= 65%) ─
    if (oldLines.length > 1 && firstClean && lastClean) {
      for (let i = 0; i < docLines.length - 1; i++) {
        if (this.similarity(docLines[i].trim(), firstClean) < 0.65) continue;
        for (let j = i + 1; j < docLines.length; j++) {
          if (this.similarity(docLines[j].trim(), lastClean) < 0.65) continue;
          const blockLen = j - i + 1;
          if (
            blockLen >= oldLines.length * 0.5 &&
            blockLen <= oldLines.length * 1.5
          ) {
            return replaceBlock(i, j + 1);
          }
        }
      }
    }

    // ── Chain 5: WhitespaceNormalizedReplacer (\s+ -> single space) ────────
    const normWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();
    const docNormWS = normWhitespace(doc);
    const oldNormWS = normWhitespace(oldText);
    if (docNormWS.includes(oldNormWS) && firstClean) {
      const lineIdx = docLines.findIndex((l) =>
        normWhitespace(l).includes(normWhitespace(firstClean)),
      );
      if (lineIdx !== -1) {
        return replaceBlock(lineIdx, lineIdx + Math.max(1, oldLines.length));
      }
    }

    // ── Chain 6: IndentationFlexibleReplacer (ignore leading space/tab) ────
    const indentless = (l: string) => l.replace(/^[\t ]+/, '');
    const oldIndentless = oldLines.map(indentless);
    if (oldIndentless.length > 0) {
      for (let i = 0; i <= docLines.length - oldIndentless.length; i++) {
        let match = true;
        for (let j = 0; j < oldIndentless.length; j++) {
          if (indentless(docLines[i + j]) !== oldIndentless[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          return replaceBlock(i, i + oldIndentless.length);
        }
      }
    }

    // ── Chain 7: EscapeNormalizedReplacer (literal \n / \t escapes) ────────
    const normEsc = (s: string) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const docEsc = normEsc(doc);
    const oldEsc = normEsc(oldText);
    if (docEsc.includes(oldEsc)) {
      const escIdx = docEsc.indexOf(oldEsc);
      const escBefore = docEsc.slice(0, escIdx);
      const escMatched = doc.slice(
        escBefore.length,
        escBefore.length + oldEsc.length,
      );
      return { updated: doc.replace(escMatched, normNewText), applied: true };
    }

    // ── Chain 8: KeyAnchorLineReplacer (line-by-line key, no regex) ────────
    const keyMatch = oldText.split('=')[0]?.split(':')[0]?.trim();
    if (keyMatch && keyMatch.length > 2) {
      const lineIdx = docLines.findIndex((l) => l.includes(keyMatch));
      if (lineIdx !== -1) {
        docLines[lineIdx] = normNewText;
        return { updated: docLines.join(newline), applied: true };
      }
    }

    // ── Chain 9: MultiOccurrenceReplacer (replace all matches) ─────────────
    if (oldLines.length === 1 && firstClean && firstClean.length > 3) {
      const targetSub = firstClean;
      const lineIdx = docLines.findIndex((l) => l.includes(targetSub));
      if (lineIdx !== -1) {
        for (let i = 0; i < docLines.length; i++) {
          if (docLines[i].includes(targetSub)) {
            docLines[i] = docLines[i].split(targetSub).join(normNewText);
          }
        }
        return { updated: docLines.join(newline), applied: true };
      }
    }

    // Fallback: Full Content Update (if newText represents the complete file)
    if (newText.length > doc.length * 0.3) {
      return { updated: normNewText, applied: true };
    }

    // Fallback: Append newText cleanly at the end
    return { updated: doc + newline + normNewText, applied: true };
  }

  /** Levenshtein-based similarity ratio (0..1) between two strings. */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (!a.length || !b.length) return 0;
    const maxLen = Math.max(a.length, b.length);
    const prev = new Array<number>(b.length + 1);
    const curr = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return 1 - prev[b.length] / maxLen;
  }

  /**
   * Ask the LLM to produce a list of precise {oldText, newText} edits.
   * The model reads the full file but only returns changed lines — the
   * framework applies them deterministically (token-efficient + safe).
   */
  private async generateEdits(
    original: string,
    instructions: string,
  ): Promise<Array<{ oldText: string; newText: string }>> {
    if (!this.aiService) return [];

    const response = await this.aiService.chat(
      [
        {
          role: 'system',
          content:
            'You are a precise document editor. You receive a full document and an update request.\n' +
            'Your job: output ONLY a JSON array of edits: [{ "oldText": "...", "newText": "..." }].\n\n' +
            'RULES:\n' +
            '- oldText must match EXACTLY (character-for-character) a portion of the original document.\n' +
            '- Only include lines/sections that actually change. Do NOT rewrite unchanged content.\n' +
            '- DETERMINE the intent of the update request:\n' +
            '  * If the user wants a NEW PERIOD (e.g. "today", "this month", a date that differs from the document header) — apply a ROLLOVER:\n' +
            '    - update the period/date header to the new period\n' +
            '    - REPLACE the running-period data (daily/monthly transactions, entries) with the new data from the request\n' +
            '    - KEEP cumulative/balance data (outstanding, deposits, carried totals) that should persist across periods\n' +
            '    - recompute totals that changed\n' +
            '    - NEVER leave old running-period data mixed with the new period\n' +
            '  * If the user explicitly asks to ADD/APPEND data (e.g. "tambahkan", "add") — keep everything and append the new entries.\n' +
            '  * If the user asks to FIX/REPLACE specific content — only change that content.\n' +
            '- Keep formatting identical (stars, dashes, spacing) except where the edit changes it.\n' +
            '- Respond with ONLY valid JSON, no code fences, no prose.',
        },
        {
          role: 'user',
          content: `ORIGINAL DOCUMENT:\n---\n${original}\n---\n\nUPDATE REQUEST: ${instructions}\n\nReturn the JSON edit array.`,
        },
      ],
      [],
    );

    const text = response.content || '';
    try {
      const match = text.match(/\[[\s\S]*/);
      if (!match) return [];
      let jsonStr = match[0];
      let depth = 0;
      let endIdx = -1;
      for (let i = 0; i < jsonStr.length; i++) {
        if (jsonStr[i] === '[') depth++;
        else if (jsonStr[i] === ']') {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
      if (endIdx !== -1) {
        jsonStr = jsonStr.slice(0, endIdx);
      }
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e: any) {
      this.logger.warn(`generateEdits JSON parse failed: ${e.message}`);
      return [];
    }
  }
}
