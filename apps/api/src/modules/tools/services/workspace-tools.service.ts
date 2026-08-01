import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service.js';
import { SearchService } from '../../search/search.service.js';
import { FileService } from '../../file/file.service.js';
import { DocumentReaderTool } from './document-reader.tool.js';
import { DocumentGeneratorTool } from './document-generator.tool.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import * as path from 'path';

@Injectable()
export class WorkspaceToolsService {
  private readonly logger = new Logger(WorkspaceToolsService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly searchService: SearchService,
    private readonly fileService: FileService,
    private readonly documentReaderTool: DocumentReaderTool,
    private readonly documentGeneratorTool: DocumentGeneratorTool,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Search keywords across indexed files inside active workspace
   */
  async searchWorkspace(
    workspaceId: string,
    query: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const results = await this.searchService.searchFiles({
        workspaceId,
        query,
      });
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
      const list = files
        .map(
          (f, i) =>
            `${i + 1}. ${f.name} (${f.type || 'file'}, ${Math.round(f.size / 1024)} KB) [path: ${f.path}]`,
        )
        .join('\n');

      return {
        status: 'success',
        data: { count: files.length, files },
        preview: list || 'Belum ada file di workspace ini.',
        metadata: {
          toolName: 'list_workspace_files',
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
          toolName: 'list_workspace_files',
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

    // If path is relative (like "workspace-data/..."), resolve relative to API base dir
    if (!path.isAbsolute(resolvedPath)) {
      // __dirname in compiled JS is dist/modules/tools/services/
      // Go up 4 levels to reach apps/api/
      const apiBase = path.resolve(__dirname, '..', '..', '..', '..');
      resolvedPath = path.resolve(apiBase, resolvedPath);
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
          toolName: 'write_workspace_file',
          displayName: 'Buat File Workspace',
          executionTime: 0,
        },
        error: { code: 'NO_ROOT_PATH', message: 'Workspace belum terhubung ke folder' },
      };
    }

    const targetPath = path.join(workspace.rootPath, filename);

    const ext = (filename.split('.').pop() || 'txt').toLowerCase();
    const validFormats = ['xlsx', 'csv', 'pdf', 'docx', 'txt', 'md', 'json'];
    const inferredFormat = validFormats.includes(ext) ? (ext as any) : 'txt';
    const targetFormat = format && validFormats.includes(format) ? format : inferredFormat;

    switch (targetFormat) {
      case 'xlsx':
        return this.documentGeneratorTool.generateExcel(
          'Data',
          rows,
          targetPath,
          targetPath,
        );
      case 'csv':
        return this.documentGeneratorTool.generateCsv(rows, targetPath, targetPath);
      case 'pdf':
        return this.documentGeneratorTool.generatePdf(
          title,
          content,
          targetPath,
          targetPath,
        );
      case 'docx':
        return this.documentGeneratorTool.generateDocx(
          title,
          content,
          targetPath,
          targetPath,
        );
      case 'txt':
      case 'md':
      case 'json':
      default: {
        const startTime = Date.now();
        try {
          await this.storageService.writeFile(targetPath, content);
          return {
            status: 'success',
            data: { path: targetPath, filename, format },
            preview: `File ${filename} berhasil dibuat di folder workspace.`,
            metadata: {
              toolName: 'write_workspace_file',
              displayName: 'Buat File Workspace',
              executionTime: Date.now() - startTime,
              filename,
              format,
            },
          };
        } catch (e) {
          return {
            status: 'error',
            data: {},
            preview: `Gagal membuat file ${filename}: ${e.message}`,
            metadata: {
              toolName: 'write_workspace_file',
              displayName: 'Buat File Workspace',
              executionTime: Date.now() - startTime,
            },
            error: { code: 'WRITE_FAILED', message: e.message },
          };
        }
      }
    }
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
          toolName: 'rename_workspace_file',
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
          toolName: 'rename_workspace_file',
          displayName: 'Ganti Nama File Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INVALID_FILENAME', message: 'Source and target filenames must differ and be non-empty' },
      };
    }

    let sourcePath = path.join(workspace.rootPath, filename);
    const targetPath = path.join(workspace.rootPath, newFilename);

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
              toolName: 'rename_workspace_file',
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
            toolName: 'rename_workspace_file',
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
          toolName: 'rename_workspace_file',
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
          toolName: 'rename_workspace_file',
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
          toolName: 'delete_workspace_file',
          displayName: 'Hapus File Workspace',
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
          toolName: 'delete_workspace_file',
          displayName: 'Hapus File Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'AMBIGUOUS_FILENAME', message: 'Pronoun filename not resolved' },
      };
    }

    let targetPath = path.join(workspace.rootPath, cleanName);

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
              toolName: 'delete_workspace_file',
              displayName: 'Hapus File Workspace',
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
            toolName: 'delete_workspace_file',
            displayName: 'Hapus File Workspace',
            executionTime: Date.now() - startTime,
          },
          error: { code: 'FILE_NOT_FOUND', message: `File ${cleanName} not found` },
        };
      }
    } else {
      filename = cleanName;
    }

    try {
      // 1. Delete physical file from disk
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
          toolName: 'delete_workspace_file',
          displayName: 'Hapus File Workspace',
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
          toolName: 'delete_workspace_file',
          displayName: 'Hapus File Workspace',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'DELETE_FAILED', message: e.message },
      };
    }
  }
}
