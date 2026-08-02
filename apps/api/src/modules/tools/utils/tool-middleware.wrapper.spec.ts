import { describe, it, expect, vi } from 'vitest';
import {
  wrapWorkspaceIsolation,
  wrapActionableError,
  applyToolMiddlewarePipeline,
} from './tool-middleware.wrapper.js';
import { Tool } from '../interfaces/tool.interface.js';

describe('ToolMiddlewareWrapper', () => {
  const mockTool: Tool = {
    name: 'test_tool',
    definition: {
      type: 'function',
      function: {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
      },
    },
    capability: {
      name: 'test_tool',
      displayName: 'Test Tool',
      description: 'Test tool capability',
      category: 'workspace',
      tags: ['test'],
    },
    execute: vi.fn().mockResolvedValue({
      status: 'success',
      data: { result: 'ok' },
      preview: 'OK',
      metadata: { toolName: 'test_tool', displayName: 'Test Tool', executionTime: 10 },
    }),
  };

  it('should allow valid path under workspace isolation wrapper', async () => {
    const wrapped = wrapWorkspaceIsolation(mockTool, '/workspace');
    const res = await wrapped.execute({ filePath: 'file.txt' });

    expect(res.status).toBe('success');
    expect(mockTool.execute).toHaveBeenCalledWith({ filePath: 'file.txt' });
  });

  it('should block path traversal outside workspace across path keys (filePath, path, targetPath)', async () => {
    const wrapped = wrapWorkspaceIsolation(mockTool, '/workspace');
    
    const res1 = await wrapped.execute({ filePath: '../etc/passwd' });
    expect(res1.status).toBe('error');
    expect(res1.error?.code).toBe('WORKSPACE_ISOLATION_VIOLATION');
    expect(res1.preview).toContain('Akses ditolak');

    const res2 = await wrapped.execute({ targetPath: '../../secret.key' });
    expect(res2.status).toBe('error');
    expect(res2.error?.code).toBe('WORKSPACE_ISOLATION_VIOLATION');
  });

  it('should enrich error results with actionable suggestions for FILE_NOT_FOUND', async () => {
    const failingTool: Tool = {
      ...mockTool,
      execute: vi.fn().mockResolvedValue({
        status: 'error',
        data: {},
        preview: 'File not found',
        metadata: { toolName: 'test_tool', displayName: 'Test Tool', executionTime: 5 },
        error: { code: 'FILE_NOT_FOUND', message: 'File /test.txt not found' },
      }),
    };

    const wrapped = wrapActionableError(failingTool);
    const res = await wrapped.execute({ path: 'test.txt' });

    expect(res.status).toBe('error');
    expect(res.data.suggested_action).toContain('search_workspace');
  });

  it('should enrich error results with actionable suggestions for INVALID_ARGS', async () => {
    const invalidArgsTool: Tool = {
      ...mockTool,
      execute: vi.fn().mockResolvedValue({
        status: 'error',
        data: {},
        preview: 'Invalid arguments',
        metadata: { toolName: 'test_tool', displayName: 'Test Tool', executionTime: 2 },
        error: { code: 'INVALID_ARGS', message: 'Field "path" wajib diisi' },
      }),
    };

    const wrapped = wrapActionableError(invalidArgsTool);
    const res = await wrapped.execute({});

    expect(res.status).toBe('error');
    expect(res.data.suggested_action).toContain('skema parameter');
  });

  it('should apply full pipeline wrapper correctly', async () => {
    const pipeline = applyToolMiddlewarePipeline(mockTool, { workspaceDir: '/workspace' });
    const res = await pipeline.execute({ filePath: 'valid.txt' });
    expect(res.status).toBe('success');
  });
});
