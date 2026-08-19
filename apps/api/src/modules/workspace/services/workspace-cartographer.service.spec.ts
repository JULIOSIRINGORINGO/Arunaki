import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceCartographerService } from './workspace-cartographer.service.js';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceCartographerService', () => {
  let service: WorkspaceCartographerService;
  let mockPrisma: any;
  let mockAiService: any;
  let mockSubAgentRunner: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'arunaki-cartographer-test-'));

    mockPrisma = {
      workspace: {
        findUnique: vi.fn(),
      },
      knowledge: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'k-1' }),
        update: vi.fn().mockResolvedValue({ id: 'k-1' }),
      },
    };

    mockAiService = {
      chat: vi.fn().mockResolvedValue({
        content: '# ARUNAKI WORKSPACE OPERATING SYSTEM\n\n## 1. Domain Profile\n- Custom dynamic analysis',
      }),
    };

    mockSubAgentRunner = {
      spawnSubAgent: vi.fn().mockResolvedValue({
        status: 'success',
        content: '# DYNAMICALLY COMPILED ARUNAKI.MD BY LLM SUB-AGENT',
      }),
    };

    service = new WorkspaceCartographerService(
      mockPrisma,
      mockAiService,
      mockSubAgentRunner,
    );
  });

  afterEach(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should return correct rules file path', () => {
    const rulesPath = service.getRulesFilePath(tempDir);
    expect(rulesPath).toBe(path.join(tempDir, '.arunaki', 'ARUNAKI.md'));
  });

  it('should read rules from .arunaki/ARUNAKI.md with memory cache', async () => {
    const arunakiDir = path.join(tempDir, '.arunaki');
    await fsp.mkdir(arunakiDir, { recursive: true });
    const filePath = path.join(arunakiDir, 'ARUNAKI.md');
    await fsp.writeFile(filePath, '# Custom Rules', 'utf8');

    const content1 = await service.getWorkspaceRules(tempDir);
    expect(content1).toBe('# Custom Rules');

    // Second read should come from cache
    const content2 = await service.getWorkspaceRules(tempDir);
    expect(content2).toBe('# Custom Rules');
  });

  it('should patch learned rules into ARUNAKI.md dynamically without duplicates', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      rootPath: tempDir,
    });

    await service.patchWorkspaceRules('ws-1', 'Always format transaction currency with RB suffix.');

    const rules = await service.getWorkspaceRules(tempDir);
    expect(rules).toContain('Always format transaction currency with RB suffix.');

    // Patching the same rule again should not create duplicates
    await service.patchWorkspaceRules('ws-1', 'Always format transaction currency with RB suffix.');
    const occurrences = (rules.match(/Always format transaction currency with RB suffix/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('should run analyzeAndBootstrap and produce dynamic LLM-generated rules without hardcoded bias', async () => {
    // Create sample files in temp workspace
    await fsp.writeFile(
      path.join(tempDir, 'transactions.csv'),
      'id,date,client,amount,method\n1,2026-08-18,Acme Corp,5000000,Transfer BCA',
      'utf8',
    );
    await fsp.writeFile(
      path.join(tempDir, 'products.txt'),
      'SKU | Item Name | Stock | Price\nPRD-01 | Widget Pro | 100 | 50000',
      'utf8',
    );

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Retail Shop',
      rootPath: tempDir,
    });

    await service.analyzeAndBootstrap('ws-1');

    const generatedRules = await service.getWorkspaceRules(tempDir);
    expect(generatedRules).toContain('DYNAMICALLY COMPILED ARUNAKI.MD BY LLM SUB-AGENT');
    // ARUNAKI.md stays an internal workspace file - never synced to the Knowledge Graph
    expect(mockPrisma.knowledge.create).not.toHaveBeenCalled();
  });

  it('should fall back to domain-agnostic structured metadata index when LLM is unavailable', async () => {
    // Force direct LLM and SubAgentRunner to fail
    service = new WorkspaceCartographerService(
      mockPrisma,
      {
        chat: vi.fn().mockRejectedValue(new Error('Network offline')),
      } as any,
      undefined,
    );

    await fsp.writeFile(
      path.join(tempDir, 'sample_data.csv'),
      'order_id,customer,total\n101,John Doe,250000',
      'utf8',
    );

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Offline Workspace',
      rootPath: tempDir,
    });

    await service.analyzeAndBootstrap('ws-1');

    const generatedRules = await service.getWorkspaceRules(tempDir);
    expect(generatedRules).toContain('# ARUNAKI WORKSPACE OPERATING SYSTEM — OFFLINE WORKSPACE');
    expect(generatedRules).toContain('sample_data.csv');
    expect(generatedRules).toContain('Tool Usage Directives');
    expect(generatedRules).toContain('Minimal Typing, Maximum Automation');
    // Ensure no hardcoded business assumptions exist in output
    expect(generatedRules).not.toContain('paracetamol');
    expect(generatedRules).not.toContain('bengkel');
  });
});
