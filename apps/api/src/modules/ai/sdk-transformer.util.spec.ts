import { describe, it, expect, afterEach } from 'vitest';
import { buildProviderOptions } from './sdk-transformer.util.js';

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

  it('sends reasoning_effort low for reasoning open-weights models (gpt-oss / deepseek-reasoner)', () => {
    expect(buildProviderOptions(openaiCompat, 'gpt-oss-120b')).toEqual({
      openai: { reasoningEffort: 'low' },
    });
    expect(buildProviderOptions(openaiCompat, 'deepseek-reasoner')).toEqual({
      openai: { reasoningEffort: 'low' },
    });
    // dynamic detection for unknown reasoning variants
    expect(buildProviderOptions(openaiCompat, 'vendor/qwen3-thinking:free')).toEqual({
      openai: { reasoningEffort: 'low' },
    });
  });

  it('honors an explicit reasoningEffort override', () => {
    expect(buildProviderOptions(openaiCompat, 'gpt-4o', 'low')).toEqual({
      openai: { reasoningEffort: 'low' },
    });
    expect(buildProviderOptions(openaiCompat, 'gpt-oss-120b', 'high')).toEqual({
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
    expect(buildProviderOptions(anthropic, 'claude-3-5-sonnet')).toBeUndefined();
  });

  it('env ARUNAKI_REASONING_EFFORT overrides and "off" disables everything', () => {
    process.env.ARUNAKI_REASONING_EFFORT = 'off';
    expect(buildProviderOptions(openaiCompat, 'gpt-oss-120b')).toBeUndefined();
    expect(buildProviderOptions(anthropic, 'claude-3-7-sonnet')).toBeUndefined();

    process.env.ARUNAKI_REASONING_EFFORT = 'high';
    expect(buildProviderOptions(openaiCompat, 'gpt-4o')).toEqual({
      openai: { reasoningEffort: 'high' },
    });
  });
});
