import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelfHealingService } from './self-healing.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';

function errorResult(message: string, code = 'ERROR'): ToolResult {
  return {
    status: 'error',
    data: {},
    preview: message,
    metadata: { toolName: 't', displayName: 'T', executionTime: 0 },
    error: { code, message },
  };
}

function successResult(): ToolResult {
  return {
    status: 'success',
    data: { ok: true },
    preview: 'ok',
    metadata: { toolName: 't', displayName: 'T', executionTime: 10 },
  };
}

describe('SelfHealingService (Gap #11-13)', () => {
  let registryMock: { executeTool: ReturnType<typeof vi.fn> };
  let service: SelfHealingService;

  beforeEach(() => {
    registryMock = { executeTool: vi.fn() };
    service = new SelfHealingService(registryMock as any, {} as any);
  });

  describe('#11 fallback tool mapping uses real registered names', () => {
    it('falls back read_workspace_file -> list_workspace_files end-to-end', async () => {
      registryMock.executeTool.mockImplementation((name: string) => {
        if (name === 'read_workspace_file') return errorResult('file not found: a.txt', 'ENOENT');
        if (name === 'list_workspace_files') return successResult();
        return errorResult(`unknown tool ${name}`);
      });

      const result = await service.executeWithHealing('read_workspace_file', {
        filePath: 'a.txt',
      });

      expect(result.healed).toBe(true);
      expect(registryMock.executeTool).toHaveBeenCalledWith(
        'list_workspace_files',
        { filePath: 'a.txt' },
      );
      expect(result.attempts.map((a) => a.strategy)).toContain(
        'fallback:list_workspace_files',
      );
    });

    it('falls back search_workspace -> list_workspace_files end-to-end', async () => {
      registryMock.executeTool.mockImplementation((name: string) => {
        if (name === 'search_workspace') return errorResult('file not found: x');
        if (name === 'list_workspace_files') return successResult();
        return errorResult(`unknown tool ${name}`);
      });

      const result = await service.executeWithHealing('search_workspace', {
        query: 'x',
      });

      expect(result.healed).toBe(true);
      expect(result.attempts.map((a) => a.strategy)).toContain(
        'fallback:list_workspace_files',
      );
    });
  });

  describe('#12 adaptive retry loop', () => {
    it('re-evaluates strategy when the error changes between retries', async () => {
      // Tool has no fallback mapping so the strategy error is never masked.
      // read sequence: [1] initial ENOENT, [2] path_correction retry -> new
      // BAD_ARGS error, [3] fix_params retry -> success.
      const readCalls = { n: 0 };
      registryMock.executeTool.mockImplementation(() => {
        readCalls.n++;
        if (readCalls.n === 1) return errorResult('file not found: a.txt', 'ENOENT');
        if (readCalls.n === 2) return errorResult('invalid argument: parameter wajib diisi', 'BAD_ARGS');
        return successResult();
      });

      const result = await service.executeWithHealing('some_tool', {
        filePath: 'a.txt',
        limit: 10,
      });

      expect(result.healed).toBe(true);
      expect(result.attempts.map((a) => a.strategy)).toEqual([
        'path_correction',
        'fix_params',
      ]);
    });

    it('skips re-running the identical strategy when error does not change', async () => {
      // Tool has no fallback mapping. path_correction cannot fix ENOENT, but
      // the guard must ensure it is NOT retried 3x with the same error.
      registryMock.executeTool.mockImplementation(() =>
        errorResult('file not found: a.txt', 'ENOENT'),
      );

      const result = await service.executeWithHealing('some_tool', {
        filePath: 'a.txt',
      });

      expect(result.healed).toBe(false);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].strategy).toBe('path_correction');
    });
  });

  describe('#13 path traversal validation', () => {
    it('blocks plain ".." traversal value in path-like args', async () => {
      const prismaMock = {
        workspace: {
          findUnique: vi.fn().mockResolvedValue({ rootPath: 'C:\\workspace' }),
        },
      };
      const svc = new SelfHealingService(registryMock as any, prismaMock as any);

      await expect(
        svc.validateToolPaths('read_workspace_file', { filePath: '..' }, 'ws-1'),
      ).rejects.toThrow('outside workspace');
    });

    it('blocks ".." traversal with leading separator (../) even without backslash root', async () => {
      const prismaMock = {
        workspace: {
          findUnique: vi.fn().mockResolvedValue({ rootPath: 'C:\\workspace' }),
        },
      };
      const svc = new SelfHealingService(registryMock as any, prismaMock as any);

      await expect(
        svc.validateToolPaths('read_workspace_file', { filePath: '../secret.txt' }, 'ws-1'),
      ).rejects.toThrow('outside workspace');
    });

    it('allows a path that stays inside the workspace root', async () => {
      const prismaMock = {
        workspace: {
          findUnique: vi.fn().mockResolvedValue({ rootPath: 'C:\\workspace' }),
        },
      };
      const svc = new SelfHealingService(registryMock as any, prismaMock as any);

      await expect(
        svc.validateToolPaths(
          'read_workspace_file',
          { filePath: 'C:\\workspace\\docs\\a.txt' },
          'ws-1',
        ),
      ).resolves.toBeUndefined();
    });
  });
});
