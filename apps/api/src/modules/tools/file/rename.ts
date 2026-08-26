import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';
import { resolvePath } from './workspace.js';

export const RenameTool = define('rename', {
  description: 'Renames or moves a file inside the workspace.',
  parameters: {
    type: 'object',
    properties: {
      oldPath: { type: 'string', description: 'Old path' },
      newPath: { type: 'string', description: 'New path' },
    },
    required: ['oldPath', 'newPath'],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { oldPath, newPath } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const sourcePath = resolvePath(oldPath, rootPath);
      const targetPath = resolvePath(newPath, rootPath);

      const exists = await fsp.access(sourcePath).then(() => true).catch(() => false);
      if (!exists) {
        return {
          status: 'error',
          data: {},
          preview: `File not found: ${oldPath}`,
          metadata: { toolName: 'rename', displayName: 'Rename File', executionTime: Date.now() - startTime },
          error: { code: 'FILE_NOT_FOUND', message: `File not found: ${oldPath}` },
        };
      }

      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.rename(sourcePath, targetPath);

      return {
        status: 'success',
        data: { oldPath: sourcePath, newPath: targetPath },
        preview: `Renamed: ${oldPath} -> ${newPath}`,
        metadata: { toolName: 'rename', displayName: 'Rename File', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to rename: ${e.message}`,
        metadata: { toolName: 'rename', displayName: 'Rename File', executionTime: Date.now() - startTime },
        error: { code: 'RENAME_FAILED', message: e.message },
      };
    }
  },
});
