import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubAgentRunnerService, SubAgentTask } from './sub-agent-runner.service.js';

describe('SubAgentRunnerService', () => {
  let service: SubAgentRunnerService;
  let mockAiService: any;
  let mockToolRegistry: any;
  let mockSelfHealing: any;

  beforeEach(() => {
    mockAiService = {
      chat: vi.fn(),
    };
    mockToolRegistry = {
      getToolDefinitions: vi.fn().mockReturnValue([
        { function: { name: 'read' } },
        { function: { name: 'calculate' } },
        { function: { name: 'generate_export' } },
      ]),
    };
    mockSelfHealing = {
      executeWithHealing: vi.fn(),
    };

    service = new SubAgentRunnerService(
      mockAiService,
      mockToolRegistry,
      mockSelfHealing,
    );
  });

  it('should spawn a sub-agent that returns text without tool calls', async () => {
    mockAiService.chat.mockResolvedValue({
      content: 'Data berhasil dianalisis: Total omzet Rp 150.000.000',
      toolCalls: [],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const task: SubAgentTask = {
      taskId: 'sub_1',
      taskName: 'Analisis Data Excel',
      taskDescription: 'Analisis data omzet dari file Excel',
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('success');
    expect(result.taskId).toBe('sub_1');
    expect(result.taskName).toBe('Analisis Data Excel');
    expect(result.content).toContain('Total omzet');
    expect(result.metadata.rounds).toBe(1);
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should spawn a sub-agent that uses tools', async () => {
    // Round 1: AI calls a tool
    mockAiService.chat.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'tc_1',
          type: 'function',
          function: {
            name: 'read',
            arguments: JSON.stringify({ path: 'data.xlsx' }),
          },
        },
      ],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    // Round 2: AI returns final text
    mockAiService.chat.mockResolvedValueOnce({
      content: 'File berhasil dibaca. Total 50 baris data.',
      toolCalls: [],
      usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
    });

    mockSelfHealing.executeWithHealing.mockResolvedValue({
      finalResult: {
        status: 'success',
        data: { rows: 50 },
        preview: 'Membaca data.xlsx — 50 baris',
        metadata: { toolName: 'read', displayName: 'Read File', executionTime: 120 },
      },
      healed: false,
      attempts: [],
    });

    const task: SubAgentTask = {
      taskId: 'sub_2',
      taskName: 'Baca File Excel',
      taskDescription: 'Baca file data.xlsx dan hitung jumlah baris',
      workspaceId: 'ws-123',
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('success');
    expect(result.toolOutputs).toHaveLength(1);
    expect(result.toolOutputs[0].toolName).toBe('read');
    expect(result.toolOutputs[0].status).toBe('success');
    expect(result.metadata.rounds).toBe(2);

    expect(mockSelfHealing.executeWithHealing).toHaveBeenCalledWith(
      'read',
      { path: 'data.xlsx' },
      'ws-123'
    );
  });

  it('should run multiple sub-agents in parallel', async () => {
    // Both sub-agents return immediately
    mockAiService.chat.mockResolvedValue({
      content: 'Tugas selesai',
      toolCalls: [],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    });

    const tasks: SubAgentTask[] = [
      { taskId: 'p1', taskName: 'Baca PDF 1', taskDescription: 'Baca faktur-1.pdf' },
      { taskId: 'p2', taskName: 'Baca PDF 2', taskDescription: 'Baca faktur-2.pdf' },
      { taskId: 'p3', taskName: 'Baca PDF 3', taskDescription: 'Baca faktur-3.pdf' },
    ];

    const results = await service.spawnParallel(tasks);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'success')).toBe(true);
    expect(results[0].taskId).toBe('p1');
    expect(results[1].taskId).toBe('p2');
    expect(results[2].taskId).toBe('p3');
  });

  it('should block tool calls outside allowedTools scope', async () => {
    // AI tries to call a tool not in allowedTools
    mockAiService.chat.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'tc_blocked',
          type: 'function',
          function: {
            name: 'generate_export',
            arguments: JSON.stringify({ format: 'xlsx' }),
          },
        },
      ],
      usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
    });

    // After blocked, AI returns final text
    mockAiService.chat.mockResolvedValueOnce({
      content: 'Tidak bisa export, hanya bisa membaca file.',
      toolCalls: [],
      usage: { promptTokens: 150, completionTokens: 40, totalTokens: 190 },
    });

    const task: SubAgentTask = {
      taskId: 'sub_scoped',
      taskName: 'Baca Saja',
      taskDescription: 'Hanya baca file, jangan export',
      allowedTools: ['read'],
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('success');
    expect(result.toolOutputs).toHaveLength(1);
    expect(result.toolOutputs[0].status).toBe('blocked');
    expect(result.toolOutputs[0].toolName).toBe('generate_export');
    // self-healing should NOT be called for blocked tools
    expect(mockSelfHealing.executeWithHealing).not.toHaveBeenCalled();
  });

  it('should handle sub-agent errors gracefully', async () => {
    mockAiService.chat.mockRejectedValue(new Error('LLM provider timeout'));

    const task: SubAgentTask = {
      taskId: 'sub_err',
      taskName: 'Tugas Gagal',
      taskDescription: 'Tugas yang akan gagal',
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('error');
    expect(result.error).toContain('LLM provider timeout');
    expect(result.content).toBe('');
    expect(result.toolOutputs).toHaveLength(0);
  });

  it('should call progress callback during execution', async () => {
    mockAiService.chat.mockResolvedValue({
      content: 'Selesai',
      toolCalls: [],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    });

    const progressEvents: any[] = [];
    const onProgress = (event: any) => progressEvents.push(event);

    const task: SubAgentTask = {
      taskId: 'sub_cb',
      taskName: 'Tugas Callback',
      taskDescription: 'Test progress callbacks',
    };

    await service.spawnSubAgent(task, onProgress);

    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents[0].type).toBe('spawned');
    expect(progressEvents[progressEvents.length - 1].type).toBe('completed');
  });
});
