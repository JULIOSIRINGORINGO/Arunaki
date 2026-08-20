import { describe, it, expect, afterEach } from 'vitest';
import {
  buildProviderOptions,
  serializeToolCallHistory,
} from './sdk-transformer.util.js';
import { modelSupportsToolCallHistory } from './model-capability.js';

const openaiCompat = { type: 'openai-compatible' };
const anthropic = { type: 'anthropic' };

afterEach(() => {
  delete process.env.ARUNAKI_REASONING_EFFORT;
  delete process.env.ANTHROPIC_THINKING_BUDGET_TOKENS;
});

describe('buildProviderOptions — reasoning effort pruning', () => {
  it('returns undefined for non-reasoning openai-compatible models (no param sent)', () => {
    expect(buildProviderOptions(openaiCompat, 'gpt-4o')).toBeUndefined();
    expect(buildProviderOptions(openaiCompat, 'deepseek-chat')).toBeUndefined();
  });

  it('sends reasoning_effort low for reasoning models (deepseek-reasoner, thinking variants)', () => {
    expect(buildProviderOptions(openaiCompat, 'deepseek-reasoner')).toEqual({
      openai: { reasoningEffort: 'low' },
    });
    // dynamic detection for unknown reasoning variants
    expect(
      buildProviderOptions(openaiCompat, 'vendor/qwen3-thinking:free'),
    ).toEqual({
      openai: { reasoningEffort: 'low' },
    });
  });

  it('treats gpt-oss as a standard tool-calling model (no reasoning_effort — Kenari drops tool definitions otherwise)', () => {
    expect(buildProviderOptions(openaiCompat, 'gpt-oss-120b')).toBeUndefined();
    expect(buildProviderOptions(openaiCompat, 'gpt-oss-20b')).toBeUndefined();
  });

  it('honors an explicit reasoningEffort override', () => {
    expect(buildProviderOptions(openaiCompat, 'gpt-4o', 'low')).toEqual({
      openai: { reasoningEffort: 'low' },
    });
    expect(
      buildProviderOptions(openaiCompat, 'deepseek-reasoner', 'high'),
    ).toEqual({
      openai: { reasoningEffort: 'high' },
    });
  });

  it('enables bounded Anthropic thinking with configurable budget (default 1024)', () => {
    expect(buildProviderOptions(anthropic, 'claude-3-7-sonnet')).toEqual({
      anthropic: { thinking: { type: 'enabled', budgetTokens: 1024 } },
    });
    process.env.ANTHROPIC_THINKING_BUDGET_TOKENS = '2048';
    expect(buildProviderOptions(anthropic, 'claude-sonnet-4')).toEqual({
      anthropic: { thinking: { type: 'enabled', budgetTokens: 2048 } },
    });
    // non-thinking Claude stays plain
    expect(
      buildProviderOptions(anthropic, 'claude-3-5-sonnet'),
    ).toBeUndefined();
  });

  it('env ARUNAKI_REASONING_EFFORT overrides and "off" disables everything', () => {
    process.env.ARUNAKI_REASONING_EFFORT = 'off';
    expect(buildProviderOptions(openaiCompat, 'gpt-oss-120b')).toBeUndefined();
    expect(
      buildProviderOptions(anthropic, 'claude-3-7-sonnet'),
    ).toBeUndefined();

    process.env.ARUNAKI_REASONING_EFFORT = 'high';
    expect(buildProviderOptions(openaiCompat, 'gpt-4o')).toEqual({
      openai: { reasoningEffort: 'high' },
    });
  });
});

describe('modelSupportsToolCallHistory', () => {
  it('flags gpt-oss (Kenari/vLLM) as not accepting tool_calls/tool in history', () => {
    expect(modelSupportsToolCallHistory('gpt-oss-20b')).toBe(false);
    expect(modelSupportsToolCallHistory('gpt-oss-120b')).toBe(false);
  });

  it('defaults to true for standard models that support native tool call history', () => {
    expect(modelSupportsToolCallHistory('gpt-4o')).toBe(true);
    expect(modelSupportsToolCallHistory('deepseek-chat')).toBe(true);
    expect(modelSupportsToolCallHistory('deepseek-v4-flash')).toBe(false);
  });
});

describe('serializeToolCallHistory', () => {
  it('flattens assistant tool_calls + following tool results into one text message', () => {
    const input = [
      { role: 'user' as const, content: 'update file' },
      {
        role: 'assistant' as const,
        content: 'ok',
        tool_calls: [
          {
            id: 'c1',
            type: 'function' as const,
            function: { name: 'edit', arguments: '{"path":"a.txt"}' },
          },
        ],
      },
      {
        role: 'tool' as const,
        tool_call_id: 'c1',
        content: '{"status":"success"}',
      },
      { role: 'user' as const, content: 'recount totals' },
    ];

    const out = serializeToolCallHistory(input);
    expect(out).toHaveLength(3);
    expect(out[1]).toEqual({
      role: 'assistant',
      content:
        'ok\n[Assistant tool call]: edit({"path":"a.txt"})\n[Tool result]: {"status":"success"}',
    });
    expect(out[2].content).toBe('recount totals');
    // no native tool/tool_calls shape survives
    expect(out.some((m) => m.role === 'tool' || (m as any).tool_calls)).toBe(
      false,
    );
  });

  it('leaves messages without tool_calls untouched', () => {
    const input = [
      { role: 'user' as const, content: 'hi' },
      { role: 'assistant' as const, content: 'hello' },
    ];
    expect(serializeToolCallHistory(input)).toEqual(input);
  });
});
