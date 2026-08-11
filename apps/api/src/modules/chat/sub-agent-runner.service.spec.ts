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
      executeWithIsolation: vi.fn(),
    };

    service = new SubAgentRunnerService(
      mockAiService,
      mockToolRegistry,
      mockSelfHealing,
    );
  });

  it('should spawn a sub-agent that returns text without tool calls', async () => {
    mockAiService.chat.mockResolvedValue({
      content: 'Data analyzed: Total revenue Rp 150.000.000',
      toolCalls: [],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const task: SubAgentTask = {
      taskId: 'sub_1',
      taskName: 'Excel Data Analysis',
      taskDescription: 'Analyze revenue data from the Excel file',
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('success');
    expect(result.taskId).toBe('sub_1');
    expect(result.taskName).toBe('Excel Data Analysis');
    expect(result.content).toContain('Total revenue');
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
      content: 'File read successfully. Total 50 rows of data.',
      toolCalls: [],
      usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
    });

    mockSelfHealing.executeWithIsolation.mockResolvedValue({
      status: 'success',
      data: { rows: 50 },
      preview: 'Reading data.xlsx — 50 rows',
      metadata: { toolName: 'read', displayName: 'Read File', executionTime: 120 },
    });

    const task: SubAgentTask = {
      taskId: 'sub_2',
      taskName: 'Read Excel File',
      taskDescription: 'Read data.xlsx and count the rows',
      workspaceId: 'ws-123',
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('success');
    expect(result.toolOutputs).toHaveLength(1);
    expect(result.toolOutputs[0].toolName).toBe('read');
    expect(result.toolOutputs[0].status).toBe('success');
    expect(result.metadata.rounds).toBe(2);

    expect(mockSelfHealing.executeWithIsolation).toHaveBeenCalledWith(
      'read',
      { path: 'data.xlsx' },
      'ws-123'
    );
  });

  it('should run multiple sub-agents in parallel', async () => {
    // Both sub-agents return immediately
    mockAiService.chat.mockResolvedValue({
      content: 'Task done',
      toolCalls: [],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    });

    const tasks: SubAgentTask[] = [
      { taskId: 'p1', taskName: 'Read PDF 1', taskDescription: 'Read invoice-1.pdf' },
      { taskId: 'p2', taskName: 'Read PDF 2', taskDescription: 'Read invoice-2.pdf' },
      { taskId: 'p3', taskName: 'Read PDF 3', taskDescription: 'Read invoice-3.pdf' },
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
      content: 'Cannot export, only read files.',
      toolCalls: [],
      usage: { promptTokens: 150, completionTokens: 40, totalTokens: 190 },
    });

    const task: SubAgentTask = {
      taskId: 'sub_scoped',
      taskName: 'Read Only',
      taskDescription: 'Only read files, do not export',
      allowedTools: ['read'],
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('success');
    expect(result.toolOutputs).toHaveLength(1);
    expect(result.toolOutputs[0].status).toBe('blocked');
    expect(result.toolOutputs[0].toolName).toBe('generate_export');
    // self-healing should NOT be called for blocked tools
    expect(mockSelfHealing.executeWithIsolation).not.toHaveBeenCalled();
  });

  it('should handle sub-agent errors gracefully', async () => {
    mockAiService.chat.mockRejectedValue(new Error('LLM provider timeout'));

    const task: SubAgentTask = {
      taskId: 'sub_err',
      taskName: 'Failed Task',
      taskDescription: 'A task that will fail',
    };

    const result = await service.spawnSubAgent(task);

    expect(result.status).toBe('error');
    expect(result.error).toContain('LLM provider timeout');
    expect(result.content).toBe('');
    expect(result.toolOutputs).toHaveLength(0);
  });

  it('should call progress callback during execution', async () => {
    mockAiService.chat.mockResolvedValue({
      content: 'Done',
      toolCalls: [],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    });

    const progressEvents: any[] = [];
    const onProgress = (event: any) => progressEvents.push(event);

    const task: SubAgentTask = {
      taskId: 'sub_cb',
      taskName: 'Callback Task',
      taskDescription: 'Test progress callbacks',
    };

    await service.spawnSubAgent(task, onProgress);

    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents[0].type).toBe('spawned');
    expect(progressEvents[progressEvents.length - 1].type).toBe('completed');
  });
});