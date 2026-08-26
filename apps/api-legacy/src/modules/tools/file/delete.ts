import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';
import { resolvePath } from './workspace.js';

export const DeleteTool = define('delete', {
  description: 'Deletes a file or directory from the workspace.',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'File or folder path' },
    },
    required: ['filePath'],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { filePath } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const targetPath = resolvePath(filePath, rootPath);

      const exists = await fsp.access(targetPath).then(() => true).catch(() => false);
      if (!exists) {
        return {
          status: 'error',
          data: {},
          preview: `File not found: ${filePath}`,
          metadata: { toolName: 'delete', displayName: 'Delete File', executionTime: Date.now() - startTime },
          error: { code: 'FILE_NOT_FOUND', message: `File not found: ${filePath}` },
        };
      }

      const stat = await fsp.stat(targetPath);
      if (stat.isDirectory()) {
        await fsp.rm(targetPath, { recursive: true });
      } else {
        await fsp.unlink(targetPath);
      }

      return {
        status: 'success',
        data: { path: targetPath, filename: path.basename(targetPath) },
        preview: `Deleted: ${filePath}`,
        metadata: { toolName: 'delete', displayName: 'Delete File', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to delete: ${e.message}`,
        metadata: { toolName: 'delete', displayName: 'Delete File', executionTime: Date.now() - startTime },
        error: { code: 'DELETE_FAILED', message: e.message },
      };
    }
  },
});
