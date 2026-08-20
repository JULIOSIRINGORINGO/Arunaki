import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { FileService } from '../../file/file.service.js';
import { ParserService } from '../../parser/parser.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const MAX_BYTES = 50 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`;
const SAMPLE_BYTES = 4096;
const BINARY_EXTS = new Set([
  '.zip',
  '.tar',
  '.gz',
  '.exe',
  '.dll',
  '.so',
  '.class',
  '.jar',
  '.war',
  '.7z',
  '.bin',
  '.dat',
  '.obj',
  '.o',
  '.a',
  '.lib',
  '.wasm',
  '.pyc',
  '.pyo',
]);

// Binary document types handled by the parser service (Arunaki document focus).
const PARSER_EXTS = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.pdf',
]);

@Injectable()
export class ReadToolService {
  private readonly logger = new Logger(ReadToolService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FileService))
    private readonly fileService: FileService,
    @Inject(forwardRef(() => ParserService))
    private readonly parserService: ParserService,
  ) {}

  async execute(params: {
    filePath: string;
    workspaceId: string;
    offset?: number;
    limit?: number;
  }): Promise<ToolResult> {
    const { filePath, workspaceId } = params;
    const offset = Math.max(1, Number(params.offset) || 1);
    const limit = Math.max(1, Number(params.limit) || DEFAULT_READ_LIMIT);
    const startTime = Date.now();

    let targetPath = filePath;

    let rootPath = '';
    if (this.prisma) {
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { rootPath: true },
        });
        if (workspace?.rootPath) {
          rootPath = workspace.rootPath;
          if (!path.isAbsolute(filePath)) {
            targetPath = path.join(workspace.rootPath, filePath);
          }
        }
      } catch {
        /* Fallback */
      }
    }

    // Workspace Isolation Enforcement (Path Traversal Protection)
    if (rootPath) {
      const resolvedTarget = path.resolve(targetPath);
      const resolvedRoot = path.resolve(rootPath);
      if (!resolvedTarget.startsWith(resolvedRoot)) {
        return {
          status: 'error',
          data: {},
          preview: `Security violation: Path traversal blocked. Cannot access files outside the workspace root.`,
          metadata: {
            toolName: 'read',
            displayName: 'Read File',
            executionTime: Date.now() - startTime,
          },
          error: {
            code: 'WORKSPACE_ISOLATION_VIOLATION',
            message: `Security violation: Path traversal blocked. Cannot access files outside the workspace root.`,
          },
        };
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
            f.name.toLowerCase().replace(/\.[^.]+$/, '') ===
              filePath.toLowerCase(),
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
      const suggestion = await this.suggestSimilar(targetPath);
      const hint =
        suggestion.length > 0
          ? `\n\nDid you mean one of these?\n${suggestion.join('\n')}`
          : '';
      return {
        status: 'error',
        data: {},
        preview: `File not found: ${filePath}${hint}`,
        metadata: {
          toolName: 'read',
          displayName: 'Read File',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'FILE_NOT_FOUND',
          message: `File not found: ${filePath}${hint}`,
        },
      };
    }

    const ext = path.extname(targetPath).toLowerCase();

    // Binary document files still go through the parser (Arunaki document focus).
    if (PARSER_EXTS.has(ext)) {
      return this.parseDocument(targetPath, filePath, workspaceId, startTime);
    }

    try {
      const sample = await this.readSample(targetPath);
      if (isBinaryFile(ext, sample)) {
        return {
          status: 'error',
          data: {},
          preview: `Cannot read binary file: ${filePath}`,
          metadata: {
            toolName: 'read',
            displayName: 'Read File',
            executionTime: Date.now() - startTime,
          },
          error: {
            code: 'BINARY_FILE',
            message: `Cannot read binary file: ${filePath}`,
          },
        };
      }

      const file = await this.readLines(targetPath, { limit, offset });
      if (file.count < offset && !(file.count === 0 && offset === 1)) {
        return {
          status: 'error',
          data: {},
          preview: `Offset ${offset} is out of range for this file (${file.count} lines)`,
          metadata: {
            toolName: 'read',
            displayName: 'Read File',
            executionTime: Date.now() - startTime,
          },
          error: {
            code: 'OFFSET_OUT_OF_RANGE',
            message: `Offset ${offset} is out of range for this file (${file.count} lines)`,
          },
        };
      }

      let output = [
        `<path>${targetPath}</path>`,
        `<type>file</type>`,
        '<content>',
      ].join('\n');
      output +=
        '\n' + file.raw.map((line, i) => `${i + offset}: ${line}`).join('\n');

      const last = offset + file.raw.length - 1;
      const next = last + 1;
      const truncated = file.more || file.cut;
      if (file.cut) {
        output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${offset}-${last}. Use offset=${next} to continue.)`;
      } else if (file.more) {
        output += `\n\n(Showing lines ${offset}-${last} of ${file.count}. Use offset=${next} to continue.)`;
      } else {
        output += `\n\n(End of file - total ${file.count} lines)`;
      }
      output += '\n</content>';

      const filename = path.basename(targetPath);
      return {
        status: 'success',
        data: {
          path: targetPath,
          filename,
          content: output,
          metadata: {},
        },
        preview: file.raw.slice(0, 20).join('\n'),
        metadata: {
          toolName: 'read',
          displayName: 'Read File',
          executionTime: Date.now() - startTime,
          filename,
          contentLength: output.length,
          truncated,
          lineStart: offset,
          lineEnd: last,
          totalLines: file.count,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to read file "${filePath}": ${e.message}`,
        metadata: {
          toolName: 'read',
          displayName: 'Read File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'READ_FAILED', message: e.message },
      };
    }
  }

  private async parseDocument(
    targetPath: string,
    filePath: string,
    workspaceId: string,
    startTime: number,
  ): Promise<ToolResult> {
    const fsPromises = await import('fs/promises');
    try {
      const ext = path.extname(targetPath).toLowerCase().replace('.', '');
      const parsed = this.parserService
        ? await this.parserService.parse(targetPath, ext)
        : {
            content: await fsPromises.readFile(targetPath, 'utf-8'),
            metadata: {},
          };

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
        preview:
          parsed.content.length > 500
            ? parsed.content.slice(0, 500) + '...'
            : parsed.content,
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
        metadata: {
          toolName: 'read',
          displayName: 'Read File',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'PARSING_FAILED', message: e.message },
      };
    }
  }

  private async suggestSimilar(targetPath: string): Promise<string[]> {
    const fsPromises = await import('fs/promises');
    const dir = path.dirname(targetPath);
    const base = path.basename(targetPath);
    try {
      const items = await fsPromises.readdir(dir);
      return items
        .filter(
          (item) =>
            item.toLowerCase().includes(base.toLowerCase()) ||
            base.toLowerCase().includes(item.toLowerCase()),
        )
        .map((item) => path.join(dir, item))
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  private async readSample(filepath: string): Promise<Uint8Array> {
    const fsPromises = await import('fs/promises');
    const fd = await fsPromises.open(filepath, 'r');
    try {
      const buf = Buffer.alloc(SAMPLE_BYTES);
      const { bytesRead } = await fd.read(buf, 0, SAMPLE_BYTES, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await fd.close();
    }
  }

  private async readLines(
    filepath: string,
    opts: { limit: number; offset: number },
  ): Promise<{ raw: string[]; count: number; cut: boolean; more: boolean }> {
    const fsPromises = await import('fs/promises');
    const start = opts.offset - 1;
    const raw: string[] = [];
    const flags = { bytes: 0, count: 0, cut: false, more: false };

    const content = await fsPromises.readFile(filepath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (const text of lines) {
      flags.count += 1;
      if (flags.count <= start) continue;

      if (raw.length >= opts.limit) {
        flags.more = true;
        continue;
      }

      const line =
        text.length > MAX_LINE_LENGTH
          ? text.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX
          : text;
      const size = Buffer.byteLength(line, 'utf-8') + (raw.length > 0 ? 1 : 0);
      if (flags.bytes + size <= MAX_BYTES) {
        raw.push(line);
        flags.bytes += size;
        continue;
      }

      flags.cut = true;
      flags.more = true;
      break;
    }

    return { raw, count: flags.count, cut: flags.cut, more: flags.more };
  }
}

function isBinaryFile(ext: string, bytes: Uint8Array): boolean {
  if (BINARY_EXTS.has(ext)) return true;

  if (bytes.length === 0) return false;

  let nonPrintableCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true;
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
      nonPrintableCount++;
    }
  }

  return nonPrintableCount / bytes.length > 0.3;
}
