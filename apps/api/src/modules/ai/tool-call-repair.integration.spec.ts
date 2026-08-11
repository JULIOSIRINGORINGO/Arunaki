import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { SelfHealingService } from './self-healing.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { SubAgentRunnerService } from '../chat/sub-agent-runner.service.js';

type FollowUpMessage = {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

type FollowUpRequest = { messages: FollowUpMessage[] };

describe('tool call repair integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('executes a tool leaked as provider text and sends its result to provider next round', async () => {
    const execute = vi.fn().mockResolvedValue({
      status: 'success',
      data: { content: 'Isi file laporan' },
      preview: 'File laporan dibaca',
      metadata: {
        toolName: 'read',
        displayName: 'Read file',
        executionTime: 0,
      },
    });
    const registry = new ToolRegistryService();
    registry.register({
      name: 'read',
      displayName: 'Read file',
      description: 'Read a workspace file',
      definition: {
        type: 'function',
        function: {
          name: 'read',
          description: 'Read a workspace file',
          parameters: {
            type: 'object',
            required: ['path'],
            properties: { path: { type: 'string' } },
          },
        },
      },
      capability: {
        name: 'read',
        displayName: 'Read file',
        description: 'Read a workspace file',
        tags: ['workspace'],
        inputSchema: { path: 'string' },
        outputType: 'text',
        estimatedLatency: 'fast',
      },
      execute,
    });

    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'test-model',
            choices: [
              {
                message: {
                  content:
                    'Cek file <tool_call>{"name":"read","arguments":{"path":"laporan.txt"}}</tool_call>',
                },
              },
            ],
            usage: {},
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'test-model',
            choices: [{ message: { content: 'File read successfully.' } }],
            usage: {},
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);

    const provider = {
      getActiveConfig: vi.fn().mockResolvedValue(null),
      getNextAvailable: vi.fn().mockResolvedValue(null),
      classifyError: vi.fn(),
      recordUsage: vi.fn(),
      recordError: vi.fn(),
      setCooldown: vi.fn(),
    };
    const ai = new AiService(
      {
        get: vi.fn(
          (key: string) =>
            ({
              AI_API_KEY: 'test-key',
              AI_BASE_URL: 'https://provider.test/v1',
              AI_MODEL: 'test-model',
            })[key],
        ),
      } as any,
      provider as any,
      registry,
    );
    const healing = new SelfHealingService(registry, {} as any);
    const runner = new SubAgentRunnerService(ai, registry, healing);

    const result = await runner.spawnSubAgent({
      taskId: 'repair-integration',
      taskName: 'Read laporan',
      taskDescription: 'Baca laporan.txt',
      allowedTools: ['read'],
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith({ path: 'laporan.txt' });
    expect(result.content).toBe('File read successfully.');
    expect(result.toolOutputs).toMatchObject([
      { toolName: 'read', status: 'success' },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);

    const secondRequest = fetch.mock.calls[1]?.[1] as RequestInit;
    const followUp = JSON.parse(
      secondRequest.body as string,
    ) as FollowUpRequest;
    const assistant = followUp.messages.find(
      (message) => message.role === 'assistant',
    );
    const tool = followUp.messages.find((message) => message.role === 'tool');
    expect(assistant?.tool_calls?.[0].function).toMatchObject({
      name: 'read',
      arguments: '{"path":"laporan.txt"}',
    });
    expect(tool?.tool_call_id).toBe(assistant?.tool_calls?.[0].id);
    expect(JSON.parse(tool?.content as string)).toMatchObject({
      status: 'success',
      data: { content: 'Isi file laporan' },
    });
  });
});
