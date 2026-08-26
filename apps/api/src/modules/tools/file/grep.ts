import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';
import { resolvePath } from './workspace.js';

const MAX_MATCHES = 100;
const MAX_LINE_LENGTH = 2000;

async function grepFiles(
  dir: string,
  pattern: string,
  include: string | undefined,
  maxMatches: number,
): Promise<Array<{ path: string; line: number; text: string }>> {
  const results: Array<{ path: string; line: number; text: string }> = [];
  const regex = new RegExp(pattern, 'g');
  const includeRegex = include
    ? new RegExp('^' + include.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    : null;

  async function walk(currentDir: string) {
    if (results.length >= maxMatches) return;
    const entries = await fsp.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxMatches) break;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (includeRegex && !includeRegex.test(entry.name)) continue;
        try {
          const content = await fsp.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxMatches) break;
            const line = lines[i];
            if (line.length > MAX_LINE_LENGTH) continue;
            regex.lastIndex = 0;
            if (regex.test(line)) {
              results.push({ path: fullPath, line: i + 1, text: line.trim() });
            }
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  await walk(dir);
  return results;
}

export const GrepTool = define('search_workspace', {
  description: 'Search file contents using regex pattern in the workspace.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      path: { type: 'string', description: 'Directory to search (default: workspace root)' },
      include: { type: 'string', description: 'File pattern filter (e.g. "*.ts")' },
    },
    required: ['pattern'],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { pattern, path: searchPath, include } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const targetDir = searchPath ? resolvePath(searchPath, rootPath) : rootPath;
      const matches = await grepFiles(targetDir, pattern, include, MAX_MATCHES);
      const truncated = matches.length === MAX_MATCHES;

      if (matches.length === 0) {
        return {
          status: 'success',
          data: { matches: [], count: 0, truncated: false },
          preview: 'No matches found',
          metadata: { toolName: 'search_workspace', displayName: 'Search Content', executionTime: Date.now() - startTime },
        };
      }

      let output = `Found ${matches.length} matches${truncated ? ' (more available)' : ''}\n\n`;
      let currentPath = '';
      for (const match of matches) {
        if (match.path !== currentPath) {
          currentPath = match.path;
          output += `${match.path}:\n`;
        }
        output += `  Line ${match.line}: ${match.text}\n`;
      }

      return {
        status: 'success',
        data: { matches, count: matches.length, truncated },
        preview: matches.slice(0, 10).map(m => `${m.path}:${m.line}: ${m.text}`).join('\n'),
        metadata: { toolName: 'search_workspace', displayName: 'Search Content', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to search content: ${e.message}`,
        metadata: { toolName: 'search_workspace', displayName: 'Search Content', executionTime: Date.now() - startTime },
        error: { code: 'GREP_FAILED', message: e.message },
      };
    }
  },
});
