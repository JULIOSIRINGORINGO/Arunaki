import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkspaceRunnerService } from './workspace-runner.service.js';
import { AiService } from '../ai/ai.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { DocumentReaderTool } from '../tools/services/document-reader.tool.js';
import { StorageService } from '../storage/storage.service.js';
import { FileService } from '../file/file.service.js';
import { SearchService } from '../search/search.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { BackgroundReviewService } from '../memory/background-review.service.js';
import { SmartRecallService } from '../memory/smart-recall.service.js';
import { SkillService } from '../skills/skill.service.js';
import { SelfHealingService } from '../ai/self-healing.service.js';
import { PromptInjectionDetector } from '../ai/prompt-injection-detector.service.js';
import { ToolLoopDetectorService } from '../ai/tool-loop-detector.service.js';
import { CompactionService } from '../ai/compaction.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ContextRegistry } from '../ai/context/context-registry.service.js';
import { DomainRegistryService } from '../domain/domain.registry.service.js';

describe('WorkspaceRunnerService (System Engine Integration Unit Test)', () => {
  let runnerService: WorkspaceRunnerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceRunnerService,
        {
          provide: AiService,
          useValue: {
            chat: vi.fn().mockResolvedValue({
              content: 'Selesai membuat laporan.',
              toolCalls: [],
            }),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getToolDefinitions: vi.fn().mockReturnValue([]),
            executeTool: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
          },
        },
        { provide: DocumentReaderTool, useValue: { readDocument: vi.fn() } },
        { provide: StorageService, useValue: { exists: vi.fn(), readFile: vi.fn() } },
        { provide: FileService, useValue: { findByWorkspaceId: vi.fn().mockResolvedValue([]) } },
        { provide: SearchService, useValue: { searchFiles: vi.fn().mockResolvedValue([]) } },
        { provide: ArtifactService, useValue: { createArtifact: vi.fn() } },
        { provide: MemoryService, useValue: { getActiveContext: vi.fn() } },
        { provide: BackgroundReviewService, useValue: {} },
        { provide: SmartRecallService, useValue: {} },
        { provide: SkillService, useValue: {} },
        { provide: SelfHealingService, useValue: {} },
        {
          provide: PromptInjectionDetector,
          useValue: { scan: vi.fn().mockReturnValue({ isInjection: false }) },
        },
        { provide: ToolLoopDetectorService, useValue: { checkLoop: vi.fn() } },
        { provide: CompactionService, useValue: {} },
        { provide: PrismaService, useValue: { workspace: { findUnique: vi.fn() } } },
        { provide: ContextRegistry, useValue: { registerContext: vi.fn() } },
        { provide: DomainRegistryService, useValue: { getDomainSpec: vi.fn() } },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
      ],
    }).compile();

    runnerService = module.get<WorkspaceRunnerService>(WorkspaceRunnerService);
  });

  it('harus memvalidasi instansiasi WorkspaceRunnerService dari NestJS Container tanpa circular dependency', () => {
    expect(runnerService).toBeDefined();
    expect(typeof runnerService.runWorkspaceAgentGenerator).toBe('function');
  });

  it('harus dapat memeriksa status running workspace (isRunning)', () => {
    const isRunning = runnerService.isRunning('test-workspace-id');
    expect(isRunning).toBe(false);
  });
});
