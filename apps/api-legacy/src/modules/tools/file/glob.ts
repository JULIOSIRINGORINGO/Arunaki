import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';
import { resolvePath } from './workspace.js';

const MAX_RESULTS = 100;

async function globFiles(dir: string, pattern: string, maxResults: number): Promise<string[]> {
  const results: string[] = [];
  const segments = pattern.split('/');

  async function walk(currentDir: string, segmentIndex: number) {
    if (results.length >= maxResults || segmentIndex >= segments.length) return;
    const segment = segments[segmentIndex];
    const isLast = segmentIndex === segments.length - 1;

    if (segment === '**') {
      const entries = await fsp.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) break;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) await walk(fullPath, segmentIndex);
        if (!isLast) await walk(fullPath, segmentIndex + 1);
      }
    } else if (segment.includes('*') || segment.includes('?')) {
      const regex = new RegExp('^' + segment.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      const entries = await fsp.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) break;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        if (!regex.test(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);
        if (isLast) {
          if (entry.isFile()) results.push(fullPath);
        } else {
          if (entry.isDirectory()) await walk(fullPath, segmentIndex + 1);
        }
      }
    } else {
      const fullPath = path.join(currentDir, segment);
      try {
        const stat = await fsp.stat(fullPath);
        if (isLast) {
          if (stat.isFile()) results.push(fullPath);
        } else {
          if (stat.isDirectory()) await walk(fullPath, segmentIndex + 1);
        }
      } catch { /* directory doesn't exist */ }
    }
  }

  await walk(dir, 0);
  return results;
}

export const GlobTool = define('glob', {
  description: 'Find files matching a glob pattern in the workspace.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. "*.ts", "src/**/*.tsx")' },
      path: { type: 'string', description: 'Directory to search (default: workspace root)' },
    },
    required: ['pattern'],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { pattern, path: searchPath } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const targetDir = searchPath ? resolvePath(searchPath, rootPath) : rootPath;
      const files = await globFiles(targetDir, pattern, MAX_RESULTS);
      const truncated = files.length === MAX_RESULTS;

      let output = files.length === 0 ? 'No files found' : files.join('\n');
      if (truncated) {
        output += `\n\n(Results truncated: showing first ${MAX_RESULTS} results. Use a more specific pattern.)`;
      }

      return {
        status: 'success',
        data: { files, count: files.length, truncated },
        preview: files.slice(0, 20).join('\n'),
        metadata: { toolName: 'glob', displayName: 'Find Files', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to search files: ${e.message}`,
        metadata: { toolName: 'glob', displayName: 'Find Files', executionTime: Date.now() - startTime },
        error: { code: 'GLOB_FAILED', message: e.message },
      };
    }
  },
});
