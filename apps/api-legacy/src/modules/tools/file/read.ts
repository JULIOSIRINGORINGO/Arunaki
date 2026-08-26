import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';
import { resolvePath } from './workspace.js';

const DEFAULT_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;

const BINARY_EXTS = new Set([
  '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.class',
  '.jar', '.war', '.7z', '.bin', '.dat', '.obj', '.o',
  '.a', '.lib', '.wasm', '.pyc', '.pyo',
]);

const PARSER_EXTS = new Set([
  '.doc', '.docx', '.xls', '.xlsx', '.xlsm',
  '.ppt', '.pptx', '.odt', '.ods', '.odp', '.pdf',
]);

export const ReadTool = define('read', {
  description: 'Reads the full content of a specified file inside the workspace.',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'File path relative or absolute' },
      offset: { type: 'number', description: 'Line offset (1-based)' },
      limit: { type: 'number', description: 'Max lines to read' },
    },
    required: ['filePath'],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { filePath, offset = 1, limit = DEFAULT_LIMIT } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const targetPath = resolvePath(filePath, rootPath);

      const exists = await fsp.access(targetPath).then(() => true).catch(() => false);
      if (!exists) {
        return {
          status: 'error',
          data: {},
          preview: `File not found: ${filePath}`,
          metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
          error: { code: 'FILE_NOT_FOUND', message: `File not found: ${filePath}` },
        };
      }

      const ext = path.extname(targetPath).toLowerCase();

      if (PARSER_EXTS.has(ext)) {
        try {
          const { ParserService } = await import('../../parser/parser.service.js');
          const parser = new ParserService();
          const parsed = await parser.parse(targetPath, ext.slice(1));
          return {
            status: 'success',
            data: { path: targetPath, filename: path.basename(targetPath), content: parsed.content },
            preview: parsed.content.slice(0, 500),
            metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
          };
        } catch (e: any) {
          return {
            status: 'error',
            data: {},
            preview: `Failed to parse document: ${e.message}`,
            metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
            error: { code: 'PARSE_FAILED', message: e.message },
          };
        }
      }

      if (BINARY_EXTS.has(ext)) {
        return {
          status: 'error',
          data: {},
          preview: `Cannot read binary file: ${filePath}`,
          metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
          error: { code: 'BINARY_FILE', message: `Cannot read binary file: ${filePath}` },
        };
      }

      const content = await fsp.readFile(targetPath, 'utf-8');
      const allLines = content.split(/\r?\n/);
      const start = Math.max(1, offset) - 1;
      const lines = allLines.slice(start, start + limit);

      let output = lines.map((line, i) => {
        const truncated = line.length > MAX_LINE_LENGTH
          ? line.substring(0, MAX_LINE_LENGTH) + '... (truncated)'
          : line;
        return `${start + i + 1}: ${truncated}`;
      }).join('\n');

      const totalLines = allLines.length;
      const last = start + lines.length;
      if (last < totalLines) {
        output += `\n\n(Showing lines ${start + 1}-${last} of ${totalLines}. Use offset=${last + 1} to continue.)`;
      } else {
        output += `\n\n(End of file - total ${totalLines} lines)`;
      }

      return {
        status: 'success',
        data: { path: targetPath, filename: path.basename(targetPath), content: output },
        preview: lines.slice(0, 20).join('\n'),
        metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to read file: ${e.message}`,
        metadata: { toolName: 'read', displayName: 'Read File', executionTime: Date.now() - startTime },
        error: { code: 'READ_FAILED', message: e.message },
      };
    }
  },
});
