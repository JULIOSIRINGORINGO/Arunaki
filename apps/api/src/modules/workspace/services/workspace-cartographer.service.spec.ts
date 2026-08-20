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

  it('should use correct section numbering when adding new rules to existing ARUNAKI.md', async () => {
    // Create ARUNAKI.md with sections 1-7
    const arunakiDir = path.join(tempDir, '.arunaki');
    await fsp.mkdir(arunakiDir, { recursive: true });
    const filePath = path.join(arunakiDir, 'ARUNAKI.md');
    const existingContent = `# ARUNAKI.md

## 1. Domain
- Test workspace

## 2. File Schemas
- Schema info

## 3. Rules
- Rule info

## 4. Cross-File
- Cross info

## 5. Naming
- Naming info

## 6. Output
- Output info

## 7. Autonomous Behavior
1. Read before write
`;
    await fsp.writeFile(filePath, existingContent, 'utf8');

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      rootPath: tempDir,
    });

    // Add first rule
    await service.patchWorkspaceRules('ws-1', 'Always update date to today');

    let rules = await service.getWorkspaceRules(tempDir);
    console.log('After first rule:', rules.slice(-200));

    // Should use ## 8 (not ## 7 again)
    expect(rules).toContain('## 8. User Preferences & Learned Corrections');
    expect(rules).not.toMatch(/## 7\. User Preferences/);

    // Add second different rule
    await service.patchWorkspaceRules('ws-1', 'Recalculate BCA total from individual transactions');

    rules = await service.getWorkspaceRules(tempDir);
    console.log('After second rule:', rules.slice(-300));

    // Should still be ## 8 (not ## 9)
    expect(rules).toContain('## 8. User Preferences & Learned Corrections');
    expect(rules).toContain('Always update date to today');
    expect(rules).toContain('Recalculate BCA total');
  });

  it('should use section 8 as minimum when no existing sections found', async () => {
    // Create minimal ARUNAKI.md without numbered sections
    const arunakiDir = path.join(tempDir, '.arunaki');
    await fsp.mkdir(arunakiDir, { recursive: true });
    const filePath = path.join(arunakiDir, 'ARUNAKI.md');
    await fsp.writeFile(filePath, '# Just a title\nSome content here', 'utf8');

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      rootPath: tempDir,
    });

    await service.patchWorkspaceRules('ws-1', 'Always format numbers with commas');

    const rules = await service.getWorkspaceRules(tempDir);
    // Should use ## 8 (minimum), not ## 1
    expect(rules).toContain('## 8. User Preferences & Learned Corrections');
  });

  it('should handle REPLACE correctly for existing learned rules', async () => {
    const arunakiDir = path.join(tempDir, '.arunaki');
    await fsp.mkdir(arunakiDir, { recursive: true });
    const filePath = path.join(arunakiDir, 'ARUNAKI.md');
    const existingContent = `# Rules

## 7. Autonomous Behavior
1. Read before write

## 8. User Preferences & Learned Corrections
- [Auto-Learned 2026-08-20]: Always update date to today
`;
    await fsp.writeFile(filePath, existingContent, 'utf8');

    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Test Workspace',
      rootPath: tempDir,
    });

    // Replace existing rule
    await service.patchWorkspaceRules('ws-1', 'REPLACE: Always update date to today -> Always update date header to current date');

    const rules = await service.getWorkspaceRules(tempDir);
    expect(rules).toContain('Always update date header to current date');
    expect(rules).not.toContain('Always update date to today');
    // Should still be ## 8 (not ## 9)
    expect(rules).toContain('## 8. User Preferences & Learned Corrections');
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
