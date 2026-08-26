import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';

export const ListTool = define('list', {
  description: 'Lists files and folders inside the workspace directory.',
  parameters: {
    type: 'object',
    properties: {
      folderPath: { type: 'string', description: 'Folder path (default: workspace root)' },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { folderPath } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const targetDir = folderPath ? path.resolve(rootPath, folderPath) : rootPath;
      const entries = await fsp.readdir(targetDir, { withFileTypes: true });
      const files: Array<{ name: string; type: string; size: number }> = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(targetDir, entry.name);
        try {
          const stat = await fsp.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          files.push({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : (ext || 'file'),
            size: stat.size,
          });
        } catch { /* skip inaccessible files */ }
      }

      const output = files.map(f => f.type === 'directory' ? `${f.name}/` : f.name).join('\n');

      return {
        status: 'success',
        data: { files, count: files.length },
        preview: output || '(empty directory)',
        metadata: { toolName: 'list', displayName: 'List Files', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to list files: ${e.message}`,
        metadata: { toolName: 'list', displayName: 'List Files', executionTime: Date.now() - startTime },
        error: { code: 'LIST_FAILED', message: e.message },
      };
    }
  },
});
