import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';
import { resolvePath } from './workspace.js';

export const WriteTool = define('write', {
  description: 'Creates a brand new file in the workspace. Fails if the file already exists. To update or modify existing files, you MUST use the edit tool.',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'File path for the new file' },
      content: { type: 'string', description: 'File content' },
    },
    required: ['filePath', 'content'],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { filePath, content } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const targetPath = resolvePath(filePath, rootPath);

      try {
        await fsp.access(targetPath);
        return {
          status: 'error',
          data: {},
          preview: `File already exists: ${filePath}. Use edit tool to modify existing files.`,
          metadata: { toolName: 'write', displayName: 'Write File', executionTime: Date.now() - startTime },
          error: { code: 'FILE_EXISTS', message: `File already exists: ${filePath}` },
        };
      } catch {
        // File doesn't exist, good
      }

      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.writeFile(targetPath, content, 'utf-8');

      return {
        status: 'success',
        data: { path: targetPath, filename: path.basename(targetPath) },
        preview: `Wrote file successfully: ${filePath}`,
        metadata: { toolName: 'write', displayName: 'Write File', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to write file: ${e.message}`,
        metadata: { toolName: 'write', displayName: 'Write File', executionTime: Date.now() - startTime },
        error: { code: 'WRITE_FAILED', message: e.message },
      };
    }
  },
});
