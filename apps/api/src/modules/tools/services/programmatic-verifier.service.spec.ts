import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgrammaticVerifierService } from './programmatic-verifier.service.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('ProgrammaticVerifierService', () => {
  let service: ProgrammaticVerifierService;
  let tempDir: string;

  beforeEach(async () => {
    service = new ProgrammaticVerifierService();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arunaki-verify-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return verified true for existing file with valid size', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'Laporan Penjualan 2026', 'utf-8');

    const result = await service.verifyFile(testFile, {
      mustExist: true,
      minSizeBytes: 5,
    });

    expect(result.verified).toBe(true);
    expect(result.checksPassed).toContain('FILE_EXISTS');
    expect(result.checksPassed).toContain('MIN_SIZE_CHECK');
  });

  it('should fail verification if file does not exist', async () => {
    const testFile = path.join(tempDir, 'nonexistent.txt');
    const result = await service.verifyFile(testFile, { mustExist: true });

    expect(result.verified).toBe(false);
    expect(result.checksFailed).toContain('FILE_EXISTS');
  });

  it('should verify JSON format correctly', async () => {
    const testFile = path.join(tempDir, 'data.json');
    await fs.writeFile(testFile, JSON.stringify({ status: 'ok' }), 'utf-8');

    const result = await service.verifyFile(testFile, {
      validFormat: 'json',
    });

    expect(result.verified).toBe(true);
    expect(result.checksPassed).toContain('VALID_JSON_FORMAT');
  });

  it('should fail JSON verification if content is invalid JSON', async () => {
    const testFile = path.join(tempDir, 'data.json');
    await fs.writeFile(testFile, 'invalid json {', 'utf-8');

    const result = await service.verifyFile(testFile, {
      validFormat: 'json',
    });

    expect(result.verified).toBe(false);
    expect(result.checksFailed).toContain('VALID_JSON_FORMAT');
  });
});
