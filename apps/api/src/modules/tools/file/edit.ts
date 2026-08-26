import * as path from 'path';
import { promises as fsp } from 'fs';
import { define } from '../tool.js';
import { resolvePath } from './workspace.js';

function replace(content: string, oldString: string, newString: string, replaceAll = false): string {
  if (oldString === newString) {
    throw new Error('No changes to apply: oldString and newString are identical.');
  }
  if (oldString === '') {
    throw new Error('oldString cannot be empty.');
  }

  if (content.includes(oldString)) {
    if (replaceAll) {
      return content.replaceAll(oldString, newString);
    }
    const index = content.indexOf(oldString);
    const lastIndex = content.lastIndexOf(oldString);
    if (index === lastIndex) {
      return content.substring(0, index) + newString + content.substring(index + oldString.length);
    }
    throw new Error('Found multiple matches for oldString. Provide more surrounding context.');
  }

  const originalLines = content.split('\n');
  const searchLines = oldString.split('\n');

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      let matchStart = 0;
      for (let k = 0; k < i; k++) {
        matchStart += originalLines[k].length + 1;
      }
      let matchEnd = matchStart;
      for (let k = 0; k < searchLines.length; k++) {
        matchEnd += originalLines[i + k].length;
        if (k < searchLines.length - 1) matchEnd += 1;
      }
      return content.substring(0, matchStart) + newString + content.substring(matchEnd);
    }
  }

  throw new Error('Could not find oldString in the file. It must match exactly, including whitespace and indentation.');
}

export const EditTool = define('edit', {
  description: 'Modifies an existing file by surgical string replacement (oldString -> newString).',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'The absolute path to the file to modify' },
      oldString: { type: 'string', description: 'The text to replace' },
      newString: { type: 'string', description: 'The text to replace it with (must be different from oldString)' },
      replaceAll: { type: 'boolean', description: 'Replace all occurrences of oldString (default false)' },
    },
    required: ['filePath', 'oldString', 'newString'],
  },
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const { filePath, oldString, newString, replaceAll = false } = args;
    const rootPath = ctx.workspaceRoot;

    try {
      const targetPath = resolvePath(filePath, rootPath);

      const exists = await fsp.access(targetPath).then(() => true).catch(() => false);
      if (!exists) {
        return {
          status: 'error',
          data: {},
          preview: `File not found: ${filePath}`,
          metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
          error: { code: 'FILE_NOT_FOUND', message: `File not found: ${filePath}` },
        };
      }

      const content = await fsp.readFile(targetPath, 'utf-8');
      const newContent = replace(content, oldString, newString, replaceAll);
      await fsp.writeFile(targetPath, newContent, 'utf-8');

      return {
        status: 'success',
        data: { path: targetPath, filename: path.basename(targetPath) },
        preview: 'Edit applied successfully.',
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to edit file: ${e.message}`,
        metadata: { toolName: 'edit', displayName: 'Edit File', executionTime: Date.now() - startTime },
        error: { code: 'EDIT_FAILED', message: e.message },
      };
    }
  },
});
