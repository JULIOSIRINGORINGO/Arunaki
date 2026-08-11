import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { FileService } from '../../file/file.service.js';
import { ParserService } from '../../parser/parser.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class WriteToolService {
  private readonly logger = new Logger(WriteToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => StorageService)) private readonly storageService: StorageService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
    @Inject(forwardRef(() => ParserService)) private readonly parserService: ParserService,
  ) {}

  async execute(params: {
    workspaceId: string;
    filename: string;
    format: string;
    content?: string;
    rows?: Record<string, any>[];
    title?: string;
  }): Promise<ToolResult> {
    const { workspaceId, filename, format, content, rows, title } = params;
    const startTime = Date.now();

    let rootPath: string | null = null;
    let defaultSourceId: string | undefined = undefined;

    if (this.prisma) {
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { rootPath: true, sources: { select: { id: true } } },
        });
        rootPath = workspace?.rootPath || null;
        defaultSourceId = workspace?.sources[0]?.id;
      } catch {
        /* Fallback */
      }
    }

    if (!rootPath) {
      rootPath = process.env.WORKSPACE_ROOT || 'E:\\LAPORAN';
    }

    const cleanFilename = filename.replace(/[/\\?%*:|"<>]/g, '_');
    const finalFilename = cleanFilename.endsWith(`.${format}`)
      ? cleanFilename
      : `${cleanFilename}.${format}`;
    const targetPath = path.join(rootPath, finalFilename);

    try {
      if (format === 'xlsx' || format === 'csv') {
        const XLSX = await import('xlsx');
        let workbook: any;
        if (rows && rows.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(rows);
          workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        } else if (content) {
          const lines = content.split('\n').map((line) => line.split(/[,;\t]/));
          const worksheet = XLSX.utils.aoa_to_sheet(lines);
          workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        } else {
          workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['No Data']]), 'Data');
        }

        if (format === 'csv') {
          const sheetName = workbook.SheetNames[0];
          const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
          if (this.storageService) {
            await this.storageService.writeFile(targetPath, csvText);
          } else {
            const fsPromises = await import('fs/promises');
            await fsPromises.writeFile(targetPath, csvText, 'utf-8');
          }
        } else {
          const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          if (this.storageService) {
            await this.storageService.writeFile(targetPath, buf.toString('binary'));
          } else {
            const fsPromises = await import('fs/promises');
            await fsPromises.writeFile(targetPath, buf);
          }
        }
      } else if (format === 'pdf') {
        const pdfText = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kinds [] /Count 0 >> endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer << /Size 3 /Root 1 0 R >>\nstartxref\n109\n%%EOF`;
        const fileContent = content || title || 'Document';
        if (this.storageService) {
          await this.storageService.writeFile(targetPath, `${pdfText}\n% Content: ${fileContent}`);
        } else {
          const fsPromises = await import('fs/promises');
          await fsPromises.writeFile(targetPath, `${pdfText}\n% Content: ${fileContent}`, 'utf-8');
        }
      } else {
        const textContent = content || (rows ? JSON.stringify(rows, null, 2) : '');
        if (this.storageService) {
          await this.storageService.writeFile(targetPath, textContent);
        } else {
          const fsPromises = await import('fs/promises');
          await fsPromises.writeFile(targetPath, textContent, 'utf-8');
        }
      }

      if (defaultSourceId && this.fileService) {
        try {
          const existingFiles = await this.fileService.findByWorkspaceId(workspaceId);
          const existing = existingFiles.find((f) => f.path === targetPath);

          let parsedText = content || '';
          if (!parsedText && this.parserService) {
            const parsed = await this.parserService.parse(targetPath, format);
            parsedText = parsed.content;
          }

          if (existing) {
            await this.fileService.updateContent(existing.id, parsedText);
            await this.fileService.updateStatus(existing.id, 'synced');
          } else {
            const fsPromises = await import('fs/promises');
            const stat = await fsPromises.stat(targetPath);
            const created = await this.fileService.create({
              name: finalFilename,
              path: targetPath,
              type: format,
              size: stat.size,
              sourceId: defaultSourceId,
            });
            await this.fileService.updateContent(created.id, parsedText);
            await this.fileService.updateStatus(created.id, 'synced');
          }
        } catch {
          /* File DB sync fallback */
        }
      }

      return {
        status: 'success',
        data: { path: targetPath, filename: finalFilename, format },
        preview: `Successfully created/updated document "${finalFilename}".`,
        metadata: {
          toolName: 'write',
          displayName: 'Create File',
          executionTime: Date.now() - startTime,
          path: targetPath,
          filename: finalFilename,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to create file "${finalFilename}": ${e.message}`,
        metadata: { toolName: 'write', displayName: 'Create File', executionTime: Date.now() - startTime },
        error: { code: 'WRITE_FAILED', message: e.message },
      };
    }
  }
}
