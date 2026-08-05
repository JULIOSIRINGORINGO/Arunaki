import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  extractMentionedFilenames,
  hasExplicitDeleteIntent,
  WorkspaceRunnerService,
} from './workspace-runner.service.js';
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
import { TodoStoreService } from '../tools/services/todo-store.service.js';
import { PromptInjectionDetector } from '../ai/prompt-injection-detector.service.js';
import { ToolLoopDetectorService } from '../ai/tool-loop-detector.service.js';
import { CompactionService } from '../ai/compaction.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ContextRegistry } from '../ai/context/context-registry.service.js';
import { DomainRegistryService } from '../domain/domain.registry.service.js';
import { ProviderService } from '../provider/provider.service.js';

describe('extractMentionedFilenames', () => {
  it('extracts an explicit file reference', () => {
    expect(extractMentionedFilenames('@REKAPAN TERBARU2.txt tambahkan pemasukan')).toEqual(['REKAPAN TERBARU2.txt']);
  });

  it('ignores ordinary @ text', () => {
    expect(extractMentionedFilenames('hubungi @agus besok')).toEqual([]);
  });
});

describe('hasExplicitDeleteIntent', () => {
  it('requires a delete verb and the exact target name', () => {
    expect(hasExplicitDeleteIntent('hapus REKAPAN TERBARU2.txt', 'REKAPAN TERBARU2.txt')).toBe(true);
    expect(hasExplicitDeleteIntent('hapus file itu', 'REKAPAN TERBARU2.txt')).toBe(false);
    expect(hasExplicitDeleteIntent('tambahkan data ke REKAPAN TERBARU2.txt', 'REKAPAN TERBARU2.txt')).toBe(false);
  });
});

describe('WorkspaceRunnerService (System Engine Integration Unit Test)', () => {
  let runnerService: WorkspaceRunnerService;
  let todoStore: TodoStoreService;

  beforeEach(async () => {
    todoStore = new TodoStoreService();
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
        { provide: ProviderService, useValue: { getActiveModel: vi.fn(), rotateProvider: vi.fn() } },
        { provide: ContextRegistry, useValue: { registerContext: vi.fn() } },
        { provide: DomainRegistryService, useValue: { getDomainSpec: vi.fn() } },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
        { provide: TodoStoreService, useValue: todoStore },
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

describe('WorkspaceRunnerService read-only parallel execution', () => {
  let runnerService: WorkspaceRunnerService;
  let maxActive = 0;
  let active = 0;
  let todoStore: TodoStoreService;

  beforeEach(async () => {
    maxActive = 0;
    active = 0;
    todoStore = new TodoStoreService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceRunnerService,
        {
          provide: AiService,
          useValue: {
            getSystemPrompt: vi.fn().mockReturnValue('system'),
            chat: vi
              .fn()
              .mockResolvedValueOnce({
                content: null,
                toolCalls: [
                  { id: 'call_1', function: { name: 'read_workspace_file', arguments: '{"filename":"a.txt"}' } },
                  { id: 'call_2', function: { name: 'search_workspace', arguments: '{"query":"x"}' } },
                  { id: 'call_3', function: { name: 'list_workspace_files', arguments: '{}' } },
                ],
              })
              .mockResolvedValue({ content: 'Selesai.', toolCalls: [] }),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getToolDefinitions: vi.fn().mockReturnValue([]),
          },
        },
        { provide: DocumentReaderTool, useValue: { readDocument: vi.fn() } },
        {
          provide: StorageService,
          useValue: { exists: vi.fn(), readFile: vi.fn() },
        },
        { provide: FileService, useValue: { findByWorkspaceId: vi.fn().mockResolvedValue([]) } },
        { provide: SearchService, useValue: { searchFiles: vi.fn().mockResolvedValue([]) } },
        { provide: ArtifactService, useValue: { createFromAgent: vi.fn() } },
        { provide: MemoryService, useValue: { getMemoryContext: vi.fn().mockResolvedValue('') } },
        { provide: BackgroundReviewService, useValue: {} },
        { provide: SmartRecallService, useValue: { recall: vi.fn().mockResolvedValue('') } },
        { provide: SkillService, useValue: { getSkillsContext: vi.fn().mockResolvedValue('') } },
        {
          provide: SelfHealingService,
          useValue: {
            executeWithHealing: vi.fn().mockImplementation(async () => {
              active++;
              maxActive = Math.max(maxActive, active);
              await new Promise((r) => setTimeout(r, 30));
              active--;
              return {
                finalResult: { status: 'success', data: { text: 'ok' } },
                healed: false,
                attempts: [],
              };
            }),
          },
        },
        { provide: PromptInjectionDetector, useValue: { scan: vi.fn().mockReturnValue({ detected: false }) } },
        { provide: ToolLoopDetectorService, useValue: { checkAndRecord: vi.fn().mockReturnValue({ isLooping: false }) } },
        { provide: CompactionService, useValue: {} },
        {
          provide: PrismaService,
          useValue: {
            workspace: { findUnique: vi.fn().mockResolvedValue({ rootPath: null, businessType: null }) },
            source: { findFirst: vi.fn().mockResolvedValue(null) },
          },
        },
        { provide: ProviderService, useValue: { getActiveModel: vi.fn(), rotateProvider: vi.fn() } },
        {
          provide: ContextRegistry,
          useValue: {
            getActive: vi.fn().mockReturnValue({
              assemble: vi.fn().mockResolvedValue({ systemPrompt: '', messages: [] }),
            }),
          },
        },
        { provide: DomainRegistryService, useValue: { getDomainSpec: vi.fn() } },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
        { provide: TodoStoreService, useValue: todoStore },
      ],
    }).compile();

    runnerService = module.get<WorkspaceRunnerService>(WorkspaceRunnerService);
  });

  it('menjalankan read-only tools secara paralel dan mempertahankan urutan tool_calls', async () => {
    const doneOrder: string[] = [];
    const events: any[] = [];

    for await (const event of runnerService.runWorkspaceAgentGenerator({
      workspaceId: 'ws-parallel-test',
      userGoal: 'bacakan file a.txt dan cari x',
      historyMessages: [{ role: 'user', content: 'bacakan file a.txt dan cari x' }],
    })) {
      events.push(event);
      if (event.type === 'tool_done') {
        doneOrder.push(event.data.toolName);
      }
    }

    expect(doneOrder).toEqual([
      'read_workspace_file',
      'search_workspace',
      'list_workspace_files',
    ]);
    expect(maxActive).toBeGreaterThan(1);
    const hasParallelEvent = events.some((e) =>
      e.type === 'tool_start' &&
      typeof e.data.toolName === 'string' &&
      e.data.toolName.startsWith('parallel ('),
    );
    expect(hasParallelEvent).toBe(true);
  });
});

describe('WorkspaceRunnerService todo list injection', () => {
  let runnerService: WorkspaceRunnerService;
  let chatMock: ReturnType<typeof vi.fn>;
  let todoStore: TodoStoreService;

  beforeEach(async () => {
    todoStore = new TodoStoreService();
    chatMock = vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: 'todo_1', function: { name: 'todo_write', arguments: '{"todos":[{"id":"1","content":"Baca file","status":"in_progress"},{"id":"2","content":"Hitung total","status":"pending"}]}' } },
        ],
      })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: 'call_1', function: { name: 'read_workspace_file', arguments: '{"filename":"a.txt"}' } },
        ],
      })
      .mockResolvedValue({ content: 'Laporan selesai.', toolCalls: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceRunnerService,
        {
          provide: AiService,
          useValue: { getSystemPrompt: vi.fn().mockReturnValue('system'), chat: chatMock },
        },
        { provide: ToolRegistryService, useValue: { getToolDefinitions: vi.fn().mockReturnValue([]) } },
        { provide: DocumentReaderTool, useValue: { readDocument: vi.fn() } },
        { provide: StorageService, useValue: { exists: vi.fn(), readFile: vi.fn() } },
        { provide: FileService, useValue: { findByWorkspaceId: vi.fn().mockResolvedValue([]) } },
        { provide: SearchService, useValue: { searchFiles: vi.fn().mockResolvedValue([]) } },
        { provide: ArtifactService, useValue: { createFromAgent: vi.fn() } },
        { provide: MemoryService, useValue: { getMemoryContext: vi.fn().mockResolvedValue('') } },
        { provide: BackgroundReviewService, useValue: {} },
        { provide: SmartRecallService, useValue: { recall: vi.fn().mockResolvedValue('') } },
        { provide: SkillService, useValue: { getSkillsContext: vi.fn().mockResolvedValue('') } },
        {
          provide: SelfHealingService,
          useValue: {
            executeWithHealing: vi.fn().mockImplementation(async (name: string, args: any) => {
              if (name === 'todo_write' && Array.isArray(args?.todos)) {
                todoStore.set(args.workspaceId || 'ws-todo-test', args.todos);
              }
              return {
                finalResult: { status: 'success', data: { text: 'ok' } },
                healed: false,
                attempts: [],
              };
            }),
          },
        },
        { provide: PromptInjectionDetector, useValue: { scan: vi.fn().mockReturnValue({ detected: false }) } },
        { provide: ToolLoopDetectorService, useValue: { checkAndRecord: vi.fn().mockReturnValue({ isLooping: false }) } },
        { provide: CompactionService, useValue: {} },
        { provide: PrismaService, useValue: { workspace: { findUnique: vi.fn().mockResolvedValue({ rootPath: null, businessType: null }) }, source: { findFirst: vi.fn().mockResolvedValue(null) } } },
        { provide: ProviderService, useValue: { getActiveModel: vi.fn(), rotateProvider: vi.fn(), getNextAvailable: vi.fn().mockResolvedValue(null) } },
        { provide: ContextRegistry, useValue: { getActive: vi.fn().mockReturnValue({ assemble: vi.fn().mockResolvedValue({ systemPrompt: '', messages: [] }) }) } },
        { provide: DomainRegistryService, useValue: { getDomainSpec: vi.fn() } },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
        { provide: TodoStoreService, useValue: todoStore },
      ],
    }).compile();

    runnerService = module.get<WorkspaceRunnerService>(WorkspaceRunnerService);
  });

  it('menyuntikkan todo list yang ditulis LLM ke context di round berikutnya', async () => {
    for await (const _ of runnerService.runWorkspaceAgentGenerator({
      workspaceId: 'ws-todo-test',
      userGoal: 'buat laporan 10 langkah',
      historyMessages: [{ role: 'user', content: 'buat laporan 10 langkah' }],
    })) {
      // drain generator
    }

    const chatCalls = chatMock.mock.calls;
    const secondRoundMessages = chatCalls[1][0] as any[];
    const todoMsg = secondRoundMessages.find(
      (m: any) => m.role === 'system' && m.content?.startsWith('=== TODO LIST ==='),
    );
    expect(todoMsg).toBeDefined();
    expect(todoMsg.content).toContain('- [in_progress] 1: Baca file');
    expect(todoMsg.content).toContain('- [pending] 2: Hitung total');
  });
});
