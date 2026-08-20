import 'reflect-metadata';
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
import { CompactionService } from '../ai/compaction.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ContextRegistry } from '../ai/context/context-registry.service.js';
import { DomainRegistryService } from '../domain/domain.registry.service.js';
import { ProviderService } from '../provider/provider.service.js';
import { SessionAdmissionService } from '../chat/session-admission.service.js';
import { WorkspacePromptBuilderService } from './services/workspace-prompt-builder.service.js';
import { WorkspaceCartographerService } from './services/workspace-cartographer.service.js';
import { TranscriptEngineService } from './services/transcript-engine.service.js';
import { ModelStreamNormalizerService } from '../ai/services/model-stream-normalizer.service.js';
import { WorkspaceRunStateService } from './services/workspace-run-state.service.js';
import { WorkspaceToolExecutorService } from './services/workspace-tool-executor.service.js';

const mockToolDefinitions = () =>
  [
    'read',
    'write',
    'edit',
    'search_workspace',
    'list',
    'todo_write',
    'ask_user',
    'agent_spawn',
  ].map((name) => ({
    type: 'function',
    function: { name, description: `Tool ${name}`, parameters: {} },
  }));

describe('extractMentionedFilenames', () => {
  it('extracts an explicit file reference', () => {
    expect(
      extractMentionedFilenames('@REKAPAN TERBARU2.txt tambahkan pemasukan'),
    ).toEqual(['REKAPAN TERBARU2.txt']);
  });

  it('ignores ordinary @ text', () => {
    expect(extractMentionedFilenames('hubungi @agus besok')).toEqual([]);
  });
});

describe('hasExplicitDeleteIntent', () => {
  it('requires a delete verb and the exact target name', () => {
    expect(
      hasExplicitDeleteIntent(
        'hapus REKAPAN TERBARU2.txt',
        'REKAPAN TERBARU2.txt',
      ),
    ).toBe(true);
    expect(
      hasExplicitDeleteIntent('hapus file itu', 'REKAPAN TERBARU2.txt'),
    ).toBe(false);
    expect(
      hasExplicitDeleteIntent(
        'tambahkan data ke REKAPAN TERBARU2.txt',
        'REKAPAN TERBARU2.txt',
      ),
    ).toBe(false);
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
          provide: WorkspaceRunStateService,
          useValue: {
            isRunning: vi.fn().mockReturnValue(false),
            setState: vi.fn(),
            getModifiedFiles: vi.fn().mockReturnValue([]),
            markFileModified: vi.fn(),
            createRunState: vi.fn().mockReturnValue({ runId: 'test-run', workspaceId: 'test-ws', abortController: { signal: {} }, currentRound: 0 }),
            cleanupRunState: vi.fn(),
            setPhase: vi.fn(),
            deleteRunState: vi.fn(),
            resetSessionTracks: vi.fn(),
            setMentionedFiles: vi.fn(),
            consumeSteeringInput: vi.fn().mockReturnValue(null),
            trackReadFile: vi.fn(),
          },
        },
        WorkspaceToolExecutorService,
        WorkspacePromptBuilderService,
        TranscriptEngineService,
        ModelStreamNormalizerService,
        {
          provide: WorkspaceCartographerService,
          useValue: { getWorkspaceRules: vi.fn().mockResolvedValue('') },
        },
        {
          provide: AiService,
          useValue: {
            chat: vi.fn().mockResolvedValue({
              content: 'Finished creating report.',
              toolCalls: [],
            }),
            classifyIntent: vi.fn().mockResolvedValue({ isMutation: false, isGui: false, tools: ['search_workspace', 'edit', 'todo_write'] }),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getToolDefinitions: vi.fn().mockReturnValue(mockToolDefinitions()),
            isMutating: vi
              .fn()
              .mockImplementation((name) =>
                [
                  'write',
                  'edit',
                  'delete',
                  'rename',
                  'desktop_send_keys',
                  'desktop_excel_edit',
                  'desktop_word_type',
                  'desktop_word_format',
                ].includes(name),
              ),
            executeTool: vi
              .fn()
              .mockResolvedValue({ status: 'success', data: {} }),
          },
        },
        { provide: DocumentReaderTool, useValue: { readDocument: vi.fn() } },
        {
          provide: StorageService,
          useValue: { exists: vi.fn(), readFile: vi.fn() },
        },
        {
          provide: FileService,
          useValue: { findByWorkspaceId: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: SearchService,
          useValue: { searchFiles: vi.fn().mockResolvedValue([]) },
        },
        { provide: ArtifactService, useValue: { createArtifact: vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: { getActiveContext: vi.fn() } },
        { provide: BackgroundReviewService, useValue: {} },
        { provide: SmartRecallService, useValue: {} },
        { provide: SkillService, useValue: {} },
        { provide: SelfHealingService, useValue: {} },
        {
          provide: PromptInjectionDetector,
          useValue: { scan: vi.fn().mockReturnValue({ isInjection: false }) },
        },
        {
          provide: CompactionService,
          useValue: {
            compactHistory: vi.fn().mockResolvedValue({ wasCompacted: false }),
          },
        },
        {
          provide: PrismaService,
          useValue: { workspace: { findUnique: vi.fn() } },
        },
        {
          provide: ProviderService,
          useValue: { getActiveModel: vi.fn(), rotateProvider: vi.fn() },
        },
        { provide: ContextRegistry, useValue: { registerContext: vi.fn() } },
        {
          provide: DomainRegistryService,
          useValue: { getDomainSpec: vi.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: vi.fn(), emitAsync: vi.fn().mockResolvedValue([]) } },
        { provide: TodoStoreService, useValue: todoStore },
        {
          provide: SessionAdmissionService,
          useValue: {
            acquireAdmission: vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
          },
        },
      ],
    }).compile();

    runnerService = module.get<WorkspaceRunnerService>(WorkspaceRunnerService);
  });

  it('validates WorkspaceRunnerService instantiation from the NestJS Container without circular dependency', () => {
    expect(runnerService).toBeDefined();
    expect(typeof runnerService.runWorkspaceAgentGenerator).toBe('function');
  });

  it('checks the running workspace status (isRunning)', () => {
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
          provide: WorkspaceRunStateService,
          useValue: {
            isRunning: vi.fn().mockReturnValue(false),
            setState: vi.fn(),
            getModifiedFiles: vi.fn().mockReturnValue([]),
            markFileModified: vi.fn(),
            createRunState: vi.fn().mockReturnValue({ runId: 'test-run', workspaceId: 'test-ws', abortController: { signal: {} }, currentRound: 0 }),
            cleanupRunState: vi.fn(),
            setPhase: vi.fn(),
            deleteRunState: vi.fn(),
            resetSessionTracks: vi.fn(),
            setMentionedFiles: vi.fn(),
            consumeSteeringInput: vi.fn().mockReturnValue(null),
            trackReadFile: vi.fn(),
          },
        },
        WorkspaceToolExecutorService,
        WorkspacePromptBuilderService,
        TranscriptEngineService,
        ModelStreamNormalizerService,
        {
          provide: WorkspaceCartographerService,
          useValue: { getWorkspaceRules: vi.fn().mockResolvedValue('') },
        },
        {
          provide: AiService,
          useValue: {
            classifyIntent: vi.fn().mockResolvedValue({ isMutation: false, isGui: false, tools: ['search_workspace', 'edit', 'todo_write'] }),
            getSystemPrompt: vi.fn().mockReturnValue('system'),
            getActiveModelContext: vi.fn().mockResolvedValue({
              model: 'deepseek-v4-flash',
              contextWindow: 32000,
              maxTokens: 8192,
            }),
            chat: vi
              .fn()
              .mockResolvedValueOnce({
                content: null,
                toolCalls: [
                  {
                    id: 'call_1',
                    function: {
                      name: 'read',
                      arguments: '{"filename":"a.txt"}',
                    },
                  },
                  {
                    id: 'call_2',
                    function: {
                      name: 'search_workspace',
                      arguments: '{"query":"x"}',
                    },
                  },
                  { id: 'call_3', function: { name: 'list', arguments: '{}' } },
                ],
              })
              .mockResolvedValue({ content: 'Selesai.', toolCalls: [] }),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getToolDefinitions: vi.fn().mockReturnValue(mockToolDefinitions()),
            isMutating: vi
              .fn()
              .mockImplementation((name) =>
                [
                  'write',
                  'edit',
                  'delete',
                  'rename',
                  'desktop_send_keys',
                  'desktop_excel_edit',
                  'desktop_word_type',
                  'desktop_word_format',
                ].includes(name),
              ),
            getToolDirectoryText: vi.fn().mockReturnValue(''),
          },
        },
        { provide: DocumentReaderTool, useValue: { readDocument: vi.fn() } },
        {
          provide: StorageService,
          useValue: { exists: vi.fn(), readFile: vi.fn() },
        },
        {
          provide: FileService,
          useValue: { findByWorkspaceId: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: SearchService,
          useValue: { searchFiles: vi.fn().mockResolvedValue([]) },
        },
        { provide: ArtifactService, useValue: { createFromAgent: vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue(null) } },
        {
          provide: MemoryService,
          useValue: { getMemoryContext: vi.fn().mockResolvedValue('') },
        },
        { provide: BackgroundReviewService, useValue: {} },
        {
          provide: SmartRecallService,
          useValue: { recall: vi.fn().mockResolvedValue('') },
        },
        {
          provide: SkillService,
          useValue: { getSkillsContext: vi.fn().mockResolvedValue('') },
        },
        {
          provide: SelfHealingService,
          useValue: {
            executeWithIsolation: vi.fn().mockImplementation(async () => {
              active++;
              maxActive = Math.max(maxActive, active);
              await new Promise((r) => setTimeout(r, 30));
              active--;
              return { status: 'success', data: { text: 'ok' } };
            }),
          },
        },
        {
          provide: PromptInjectionDetector,
          useValue: { scan: vi.fn().mockReturnValue({ detected: false }) },
        },
        {
          provide: CompactionService,
          useValue: {
            compactHistory: vi.fn().mockResolvedValue({ wasCompacted: false }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            workspace: {
              findUnique: vi
                .fn()
                .mockResolvedValue({ rootPath: null, businessType: null }),
            },
            source: { findFirst: vi.fn().mockResolvedValue(null) },
          },
        },
        {
          provide: ProviderService,
          useValue: { getActiveModel: vi.fn(), rotateProvider: vi.fn() },
        },
        {
          provide: ContextRegistry,
          useValue: {
            getActive: vi.fn().mockReturnValue({
              assemble: vi
                .fn()
                .mockResolvedValue({ systemPrompt: '', messages: [] }),
            }),
          },
        },
        {
          provide: DomainRegistryService,
          useValue: { getDomainSpec: vi.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: vi.fn(), emitAsync: vi.fn().mockResolvedValue([]) } },
        { provide: TodoStoreService, useValue: todoStore },
        {
          provide: SessionAdmissionService,
          useValue: {
            acquireAdmission: vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
          },
        },
      ],
    }).compile();

    runnerService = module.get<WorkspaceRunnerService>(WorkspaceRunnerService);
  });

  it('runs read-only tools in parallel while preserving the tool_calls order', async () => {
    const doneOrder: string[] = [];
    const events: any[] = [];

    for await (const event of runnerService.runWorkspaceAgentGenerator({
      workspaceId: 'ws-parallel-test',
      userGoal: 'read a.txt and search for x',
      historyMessages: [
        { role: 'user', content: 'read a.txt and search for x' },
      ],
    })) {
      events.push(event);
      if (event.type === 'tool_done') {
        doneOrder.push(event.data.toolName);
      }
    }

    if (doneOrder.length === 0)
      console.log('DEBUG EVENTS:', JSON.stringify(events, null, 2));

    expect(doneOrder).toEqual(['read', 'search_workspace', 'list']);
    expect(maxActive).toBeGreaterThan(1);
    const hasParallelEvent = events.some(
      (e) =>
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
          {
            id: 'todo_1',
            function: {
              name: 'todo_write',
              arguments:
                '{"todos":[{"id":"1","content":"Baca file","status":"in_progress"},{"id":"2","content":"Hitung total","status":"pending"}]}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: 'call_1',
            function: {
              name: 'todo_write',
              arguments:
                '{"todos":[{"id":1,"content":"Baca file","status":"in_progress"},{"id":2,"content":"Hitung total","status":"pending"}]}',
            },
          },
        ],
      })
      .mockResolvedValue({ content: 'Laporan selesai.', toolCalls: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceRunnerService,
        {
          provide: WorkspaceRunStateService,
          useValue: {
            isRunning: vi.fn().mockReturnValue(false),
            setState: vi.fn(),
            getModifiedFiles: vi.fn().mockReturnValue([]),
            markFileModified: vi.fn(),
            createRunState: vi.fn().mockReturnValue({ runId: 'test-run', workspaceId: 'test-ws', abortController: { signal: {} }, currentRound: 0 }),
            cleanupRunState: vi.fn(),
            setPhase: vi.fn(),
            deleteRunState: vi.fn(),
            resetSessionTracks: vi.fn(),
            setMentionedFiles: vi.fn(),
            consumeSteeringInput: vi.fn().mockReturnValue(null),
            trackReadFile: vi.fn(),
          },
        },
        WorkspaceToolExecutorService,
        WorkspacePromptBuilderService,
        TranscriptEngineService,
        ModelStreamNormalizerService,
        {
          provide: WorkspaceCartographerService,
          useValue: { getWorkspaceRules: vi.fn().mockResolvedValue('') },
        },
        {
          provide: AiService,
          useValue: {
            classifyIntent: vi.fn().mockResolvedValue({ isMutation: false, isGui: false, tools: ['search_workspace', 'edit', 'todo_write'] }),
            getSystemPrompt: vi.fn().mockReturnValue('system'),
            getActiveModelContext: vi
              .fn()
              .mockResolvedValue({ contextWindow: 32000 }),
            chat: chatMock,
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getToolDefinitions: vi.fn().mockReturnValue(mockToolDefinitions()),
            isMutating: vi
              .fn()
              .mockImplementation((name) =>
                [
                  'write',
                  'edit',
                  'delete',
                  'rename',
                  'desktop_send_keys',
                  'desktop_excel_edit',
                  'desktop_word_type',
                  'desktop_word_format',
                ].includes(name),
              ),
          },
        },
        { provide: DocumentReaderTool, useValue: { readDocument: vi.fn() } },
        {
          provide: StorageService,
          useValue: { exists: vi.fn(), readFile: vi.fn() },
        },
        {
          provide: FileService,
          useValue: { findByWorkspaceId: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: SearchService,
          useValue: { searchFiles: vi.fn().mockResolvedValue([]) },
        },
        { provide: ArtifactService, useValue: { createFromAgent: vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue(null) } },
        {
          provide: MemoryService,
          useValue: { getMemoryContext: vi.fn().mockResolvedValue('') },
        },
        { provide: BackgroundReviewService, useValue: {} },
        {
          provide: SmartRecallService,
          useValue: { recall: vi.fn().mockResolvedValue('') },
        },
        {
          provide: SkillService,
          useValue: { getSkillsContext: vi.fn().mockResolvedValue('') },
        },
        {
          provide: SelfHealingService,
          useValue: {
            executeWithIsolation: vi
              .fn()
              .mockImplementation(async (name: string, args: any) => {
                if (name === 'todo_write' && Array.isArray(args?.todos)) {
                  todoStore.set(args.workspaceId || 'ws-todo-test', args.todos);
                }
                return { status: 'success', data: { text: 'ok' } };
              }),
          },
        },
        {
          provide: PromptInjectionDetector,
          useValue: { scan: vi.fn().mockReturnValue({ detected: false }) },
        },
        {
          provide: CompactionService,
          useValue: {
            compactHistory: vi.fn().mockResolvedValue({ wasCompacted: false }),
          },
        },
        {
          provide: CompactionService,
          useValue: {
            compactHistory: vi.fn().mockResolvedValue({ wasCompacted: false }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            workspace: {
              findUnique: vi
                .fn()
                .mockResolvedValue({ rootPath: null, businessType: null }),
            },
            source: { findFirst: vi.fn().mockResolvedValue(null) },
          },
        },
        {
          provide: ProviderService,
          useValue: {
            getActiveModel: vi.fn(),
            rotateProvider: vi.fn(),
            getNextAvailable: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ContextRegistry,
          useValue: {
            getActive: vi.fn().mockReturnValue({
              assemble: vi
                .fn()
                .mockResolvedValue({ systemPrompt: '', messages: [] }),
            }),
          },
        },
        {
          provide: DomainRegistryService,
          useValue: { getDomainSpec: vi.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: vi.fn(), emitAsync: vi.fn().mockResolvedValue([]) } },
        { provide: TodoStoreService, useValue: todoStore },
        {
          provide: SessionAdmissionService,
          useValue: {
            acquireAdmission: vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
          },
        },
      ],
    }).compile();

    runnerService = module.get<WorkspaceRunnerService>(WorkspaceRunnerService);
  });

  it('injects the LLM-written todo list into the context on the next round', async () => {
    for await (const _ of runnerService.runWorkspaceAgentGenerator({
      workspaceId: 'ws-todo-test',
      userGoal: 'create a 10-step report',
      historyMessages: [{ role: 'user', content: 'create a 10-step report' }],
    })) {
      // drain generator
    }

    const chatCalls = chatMock.mock.calls;
    const secondRoundMessages = chatCalls[1][0] as any[];
    const todoMsg = secondRoundMessages.find(
      (m: any) =>
        m.role === 'system' && m.content?.startsWith('=== TODO LIST ==='),
    );
    expect(todoMsg).toBeDefined();
    expect(todoMsg.content).toContain('- [in_progress] 1: Baca file');
    expect(todoMsg.content).toContain('- [pending] 2: Hitung total');
  });
});

describe('WorkspaceRunnerService undeclared tool rejection', () => {
  let runnerService: WorkspaceRunnerService;
  let healMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    healMock = vi.fn().mockImplementation(async (name: string) => ({
      status: 'success',
      data: { text: `ran:${name}` },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceRunnerService,
        {
          provide: WorkspaceRunStateService,
          useValue: {
            isRunning: vi.fn().mockReturnValue(false),
            setState: vi.fn(),
            getModifiedFiles: vi.fn().mockReturnValue([]),
            markFileModified: vi.fn(),
            createRunState: vi.fn().mockReturnValue({ runId: 'test-run', workspaceId: 'test-ws', abortController: { signal: {} }, currentRound: 0 }),
            cleanupRunState: vi.fn(),
            setPhase: vi.fn(),
            deleteRunState: vi.fn(),
            resetSessionTracks: vi.fn(),
            setMentionedFiles: vi.fn(),
            consumeSteeringInput: vi.fn().mockReturnValue(null),
            trackReadFile: vi.fn(),
          },
        },
        WorkspaceToolExecutorService,
        WorkspacePromptBuilderService,
        TranscriptEngineService,
        ModelStreamNormalizerService,
        {
          provide: WorkspaceCartographerService,
          useValue: { getWorkspaceRules: vi.fn().mockResolvedValue('') },
        },
        {
          provide: AiService,
          useValue: {
            classifyIntent: vi.fn().mockResolvedValue({ isMutation: false, isGui: false, tools: ['search_workspace', 'edit', 'todo_write'] }),
            getSystemPrompt: vi.fn().mockReturnValue('system'),
            getActiveModelContext: vi
              .fn()
              .mockResolvedValue({ contextWindow: 32000 }),
            chat: vi
              .fn()
              .mockResolvedValueOnce({
                content: null,
                toolCalls: [
                  {
                    id: 'c1',
                    function: {
                      name: 'web_search',
                      arguments: '{"query":"test"}',
                    },
                  },
                  {
                    id: 'c2',
                    function: {
                      name: 'edit',
                      arguments: '{"filename":"a.txt"}',
                    },
                  },
                  {
                    id: 'c3',
                    function: {
                      name: 'read',
                      arguments: '{"filename":"a.txt"}',
                    },
                  },
                ],
              })
              .mockResolvedValue({ content: 'Selesai.', toolCalls: [] }),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getToolDefinitions: vi.fn().mockReturnValue(mockToolDefinitions()),
            isMutating: vi.fn().mockReturnValue(false),
          },
        },
        { provide: DocumentReaderTool, useValue: { readDocument: vi.fn() } },
        {
          provide: StorageService,
          useValue: { exists: vi.fn(), readFile: vi.fn() },
        },
        {
          provide: FileService,
          useValue: { findByWorkspaceId: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: SearchService,
          useValue: { searchFiles: vi.fn().mockResolvedValue([]) },
        },
        { provide: ArtifactService, useValue: { createFromAgent: vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue(null) } },
        {
          provide: MemoryService,
          useValue: { getMemoryContext: vi.fn().mockResolvedValue('') },
        },
        { provide: BackgroundReviewService, useValue: {} },
        {
          provide: SmartRecallService,
          useValue: { recall: vi.fn().mockResolvedValue('') },
        },
        {
          provide: SkillService,
          useValue: { getSkillsContext: vi.fn().mockResolvedValue('') },
        },
        {
          provide: SelfHealingService,
          useValue: { executeWithIsolation: healMock },
        },
        {
          provide: PromptInjectionDetector,
          useValue: { scan: vi.fn().mockReturnValue({ detected: false }) },
        },
        {
          provide: CompactionService,
          useValue: {
            compactHistory: vi.fn().mockResolvedValue({ wasCompacted: false }),
          },
        },
        {
          provide: CompactionService,
          useValue: {
            compactHistory: vi.fn().mockResolvedValue({ wasCompacted: false }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            workspace: {
              findUnique: vi
                .fn()
                .mockResolvedValue({ rootPath: null, businessType: null }),
            },
          },
        },
        {
          provide: ContextRegistry,
          useValue: {
            getActive: vi.fn().mockReturnValue({
              assemble: vi
                .fn()
                .mockResolvedValue({ systemPrompt: '', messages: [] }),
            }),
          },
        },
        {
          provide: DomainRegistryService,
          useValue: { getDomainSpec: vi.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: vi.fn(), emitAsync: vi.fn().mockResolvedValue([]) } },
        {
          provide: ProviderService,
          useValue: { getNextAvailable: vi.fn().mockResolvedValue(null) },
        },
        { provide: TodoStoreService, useValue: new TodoStoreService() },
        {
          provide: SessionAdmissionService,
          useValue: {
            acquireAdmission: vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
          },
        },
      ],
    }).compile();

    runnerService = module.get<WorkspaceRunnerService>(WorkspaceRunnerService);
  });

  it('rejects tools not declared in the subset while running declared ones', async () => {
    for await (const _ of runnerService.runWorkspaceAgentGenerator({
      workspaceId: 'ws-reject-test',
      userGoal: 'read file a.txt',
      historyMessages: [{ role: 'user', content: 'read file a.txt' }],
    })) {
      // consume stream
    }

    const calledNames = healMock.mock.calls.map((c: any[]) => c[0]);
    expect(calledNames).not.toContain('web_search');
    expect(calledNames).toContain('edit');
    expect(calledNames).toContain('read');
  });
});
