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

describe('SelfHealingService (workspace isolation guard)', () => {
  let registryMock: { executeTool: ReturnType<typeof vi.fn> };
  let service: SelfHealingService;

  beforeEach(() => {
    registryMock = { executeTool: vi.fn() };
    service = new SelfHealingService(registryMock as any, {} as any);
  });

  describe('executeWithIsolation', () => {
    it('executes the tool once and returns the result verbatim (no retries)', async () => {
      const failure = errorResult('file not found: a.txt', 'ENOENT');
      registryMock.executeTool.mockResolvedValue(failure);

      const result = await service.executeWithIsolation('read', {
        filePath: 'a.txt',
      });

      expect(result).toBe(failure);
      expect(registryMock.executeTool).toHaveBeenCalledTimes(1);
    });

    it('returns success results unchanged', async () => {
      registryMock.executeTool.mockResolvedValue(successResult());

      const result = await service.executeWithIsolation('read', {
        filePath: 'a.txt',
      });

      expect(result.status).toBe('success');
    });

    it('returns an isolation violation instead of executing when path escapes the workspace', async () => {
      const prismaMock = {
        workspace: {
          findUnique: vi.fn().mockResolvedValue({ rootPath: 'C:\\workspace' }),
        },
      };
      const svc = new SelfHealingService(registryMock as any, prismaMock as any);

      const result = await svc.executeWithIsolation(
        'read',
        { filePath: '../secret.txt' },
        'ws-1',
      );

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('WORKSPACE_ISOLATION_VIOLATION');
      expect(registryMock.executeTool).not.toHaveBeenCalled();
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
        svc.validateToolPaths('read', { filePath: '..' }, 'ws-1'),
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
        svc.validateToolPaths('read', { filePath: '../secret.txt' }, 'ws-1'),
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
          'read',
          { filePath: 'C:\\workspace\\docs\\a.txt' },
          'ws-1',
        ),
      ).resolves.toBeUndefined();
    });
  });
});
