import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PtcExecutorService } from './ptc-executor.service.js';
import { ToolRegistryService } from '../tool-registry.service.js';

describe('PtcExecutorService (DeepSeek Harness PTC Engine)', () => {
  let ptcService: PtcExecutorService;
  let mockToolRegistry: any;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arunaki-ptc-test-'));
    mockToolRegistry = {
      isMutating: vi.fn((toolName: string) =>
        ['edit', 'write', 'delete'].includes(toolName),
      ),
      executeTool: vi.fn(),
    };
    ptcService = new PtcExecutorService(mockToolRegistry);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('executes a multi-tool batch successfully', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'Initial content', 'utf-8');

    mockToolRegistry.executeTool
      .mockResolvedValueOnce({ status: 'success', data: 'Initial content' }) // read
      .mockResolvedValueOnce({ status: 'success', data: 'Updated content' }); // edit

    const result = await ptcService.executeBatch(
      'ws-1',
      tempDir,
      [
        { tool: 'read', args: { filePath: testFile } },
        { tool: 'edit', args: { filePath: testFile, replacements: [] } },
      ],
      { atomic: true },
    );

    expect(result.status).toBe('success');
    expect(result.totalSteps).toBe(2);
    expect(result.completedSteps).toBe(2);
    expect(result.rolledBack).toBe(false);
  });

  it('atomically rolls back touched files if a mutation step fails', async () => {
    const testFile = path.join(tempDir, 'ledger.txt');
    const originalContent = 'REKAPAN PENJUALAN 10 AGUSTUS 2026\nTOTAL = 100RB';
    fs.writeFileSync(testFile, originalContent, 'utf-8');

    // Simulate Step 1 mutating the file
    mockToolRegistry.executeTool.mockImplementationOnce(async () => {
      fs.writeFileSync(testFile, 'CORRUPTED MID-STATE DATA', 'utf-8');
      return { status: 'success', data: 'Applied edit 1' };
    });

    // Simulate Step 2 throwing an error
    mockToolRegistry.executeTool.mockResolvedValueOnce({
      status: 'error',
      error: {
        code: 'SYNTAX_ERR',
        message: 'Calculation syntax error on step 2',
      },
    });

    const result = await ptcService.executeBatch(
      'ws-1',
      tempDir,
      [
        { tool: 'edit', args: { filePath: testFile } },
        { tool: 'edit', args: { filePath: testFile } },
      ],
      { atomic: true },
    );

    expect(result.status).toBe('error');
    expect(result.rolledBack).toBe(true);
    expect(result.completedSteps).toBe(1);

    // Verify file was restored to originalContent
    const fileAfterRollback = fs.readFileSync(testFile, 'utf-8');
    expect(fileAfterRollback).toBe(originalContent);
  });
});
