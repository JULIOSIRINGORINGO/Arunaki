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

    switch (format) {
      case 'xlsx':
        return this.documentGeneratorTool.generateExcel(
          'Data',
          rows,
          targetPath,
        );
      case 'csv':
        return this.documentGeneratorTool.generateCsv(rows, targetPath);
      case 'pdf':
        return this.documentGeneratorTool.generatePdf(
          title,
          content,
          targetPath,
        );
      case 'docx':
        return this.documentGeneratorTool.generateDocx(
          title,
          content,
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
}
