import { describe, it, expect, vi } from 'vitest';
import { CompactionService } from './compaction.service.js';
import { ChatMessage } from './ai.service.js';
import { countTokens } from './tokenizer.js';

function msg(role: string, content: string): ChatMessage {
  return { role: role as ChatMessage['role'], content };
}

const LONG_LINE = 'Kalimat panjang untuk menguji kompaksi token. '.repeat(30);

describe('CompactionService (Gap #14/#15)', () => {
  it('does not compact history under the token threshold', async () => {
    const svc = new CompactionService(undefined);
    const messages = [msg('user', 'halo'), msg('assistant', 'hai')];

    const result = await svc.compactHistory(messages);

    expect(result.wasCompacted).toBe(false);
    expect(result.compactedMessages).toBe(messages);
  });

  it('compacts when total tokens exceed the threshold, keeping recent + summary', async () => {
    const svc = new CompactionService(undefined);
    const messages = [
      msg('system', 'kamu asisten'),
      ...Array.from({ length: 500 }, (_, i) =>
        msg(i % 2 === 0 ? 'user' : 'assistant', `${LONG_LINE} pesan #${i}`),
      ),
    ];

    const result = await svc.compactHistory(messages);

    expect(result.wasCompacted).toBe(true);
    expect(result.compactedMessages[0].role).toBe('system');
    expect(result.compactedMessages[1].content).toContain('COMPACTION SUMMARY');
    const recent = result.compactedMessages.filter((m) => m.role !== 'system');
    expect(recent.length).toBeGreaterThan(0);
  });

  it('splits recent vs older by token budget, keeping a single oversized tail message', async () => {    const svc = new CompactionService(undefined);
    const bigLine = 'Y'.repeat(100_000); // ~25k tokens, exceeds RECENT_TOKENS_BUDGET alone
    const messages = [
      ...Array.from({ length: 200 }, (_, i) => msg('user', `${LONG_LINE} pesan #${i}`)),
      msg('user', 'pesan kedua terakhir'),
      msg('user', bigLine),
    ];

    const result = await svc.compactHistory(messages);

    expect(result.wasCompacted).toBe(true);
    // The oversized tail message must not be dropped even though it exceeds
    // the recent budget on its own (the >=2 recent guard keeps it).
    const recent = result.compactedMessages.filter((m) => m.role !== 'system');
    expect(recent.some((m) => m.content === bigLine)).toBe(true);
    expect(recent.length).toBeGreaterThanOrEqual(2);
  }, 20_000);

  it('caps the LLM summary input at MAX_SUMMARY_INPUT_TOKENS', async () => {
    const chat = vi.fn().mockResolvedValue({ content: 'ringkasan' });
    const aiService = { chat } as any;
    const svc = new CompactionService(aiService);
    const messages = [
      msg('user', 'permulaan'),
      ...Array.from({ length: 1000 }, (_, i) =>
        msg(i % 2 === 0 ? 'user' : 'assistant', `${LONG_LINE} pesan #${i}`),
      ),
    ];

    await svc.compactHistory(messages);

    expect(chat).toHaveBeenCalledTimes(1);
    const userInput = chat.mock.calls[0][0].find((m: ChatMessage) => m.role === 'user');
    const tokens = countTokens(userInput.content);
    expect(tokens).toBeLessThanOrEqual(30_500);
  });

  it('falls back to the non-LLM summary when the LLM call throws', async () => {
    const aiService = { chat: vi.fn().mockRejectedValue(new Error('context overflow')) } as any;
    const svc = new CompactionService(aiService);
    const messages = [
      msg('user', 'permulaan'),
      ...Array.from({ length: 500 }, (_, i) => msg('user', `${LONG_LINE} pesan #${i}`)),
    ];

    const result = await svc.compactHistory(messages);

    expect(result.wasCompacted).toBe(true);
    expect(
      result.compactedMessages.some((m) =>
        typeof m.content === 'string' && m.content.includes('COMPACTION SUMMARY'),
      ),
    ).toBe(true);
  });

  it('compacts earlier when given a small model context window (32K)', async () => {
    const svc = new CompactionService(undefined);
    // 250 messages * LONG_LINE ≈ 250 * ~250 tokens ≈ 62K tokens.
    // Over the default 60K threshold too, but we want to verify the window
    // path independently: use fewer messages that stay under the 60K default
    // but exceed the 32K window threshold (0.75 * 32000 = 24000).
    const messages = [
      msg('system', 'asisten'),
      ...Array.from({ length: 120 }, (_, i) =>
        msg(i % 2 === 0 ? 'user' : 'assistant', `${LONG_LINE} pesan #${i}`),
      ),
    ];

    const result = await svc.compactHistory(messages, 32000);

    expect(result.wasCompacted).toBe(true);
    expect(result.compactedMessages[0].role).toBe('system');
    expect(result.compactedMessages[1].content).toContain('COMPACTION SUMMARY');
  });

  it('does not compact under the window threshold even when over a tighter budget', async () => {
    const svc = new CompactionService(undefined);
    const messages = [
      msg('user', 'halo'),
      msg('assistant', 'hai'),
    ];

    const result = await svc.compactHistory(messages, 32000);

    expect(result.wasCompacted).toBe(false);
  });
});
