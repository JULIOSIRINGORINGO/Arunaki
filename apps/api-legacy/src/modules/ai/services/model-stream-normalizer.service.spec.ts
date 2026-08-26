import { describe, it, expect } from 'vitest';
import { ModelStreamNormalizerService } from './model-stream-normalizer.service';
import { StreamChunk } from '../stream-chat';

describe('ModelStreamNormalizerService', () => {
  const normalizer = new ModelStreamNormalizerService();

  async function collectChunks(
    generator: AsyncGenerator<StreamChunk>,
  ): Promise<StreamChunk[]> {
    const chunks: StreamChunk[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  }

  async function* toGenerator(
    chunks: StreamChunk[],
  ): AsyncGenerator<StreamChunk> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  it('separates cross-chunk <think>...</think> reasoning from assistant prose', async () => {
    const rawChunks: StreamChunk[] = [
      { type: 'content', content: '<th' },
      { type: 'content', content: 'ink>Let me recalculate ' },
      { type: 'content', content: 'the totals for today</' },
      { type: 'content', content: 'think>Laporan hari ini ' },
      { type: 'content', content: 'sudah diperbarui.' },
    ];

    const stream = normalizer.normalizeStream(toGenerator(rawChunks));
    const result = await collectChunks(stream);

    const reasoning = result
      .filter((c) => c.type === 'reasoning')
      .map((c) => (c as any).content)
      .join('');
    const content = result
      .filter((c) => c.type === 'content')
      .map((c) => (c as any).content)
      .join('');

    expect(reasoning).toContain('Let me recalculate the totals for today');
    expect(content).toContain('Laporan hari ini sudah diperbarui.');
    expect(content).not.toContain('<think>');
    expect(content).not.toContain('</think>');
    expect(content).not.toContain('Let me recalculate');
  });

  it('passes through native reasoning chunks directly', async () => {
    const rawChunks: StreamChunk[] = [
      { type: 'reasoning', content: 'Evaluating customer payments...' },
      { type: 'content', content: 'Total kas BCA adalah Rp 1.432.000' },
    ];

    const stream = normalizer.normalizeStream(toGenerator(rawChunks));
    const result = await collectChunks(stream);

    const reasoning = result
      .filter((c) => c.type === 'reasoning')
      .map((c) => (c as any).content)
      .join('');
    const content = result
      .filter((c) => c.type === 'content')
      .map((c) => (c as any).content)
      .join('');

    expect(reasoning).toBe('Evaluating customer payments...');
    expect(content).toBe('Total kas BCA adalah Rp 1.432.000');
  });

  it('intercepts leaked [Assistant tool call] text and converts to native tool_call chunk', async () => {
    const leakedText = `[Assistant tool call]: edit(filePath="REKAPAN.txt", oldString="OLD", newString="NEW")`;
    const rawChunks: StreamChunk[] = [{ type: 'content', content: leakedText }];

    const stream = normalizer.normalizeStream(toGenerator(rawChunks));
    const result = await collectChunks(stream);

    const toolCalls = result.filter((c) => c.type === 'tool_call');
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(toolCalls[0].toolCall?.name).toBe('edit');
    expect(toolCalls[0].toolCall?.arguments).toContain('REKAPAN.txt');
  });

  it('sanitizes assistant history by removing thinking blocks and leaked tool calls', () => {
    const dirtyHistory = `
<think>
Internal chain of thought:
Check balance of BCA and compare against deposit.
</think>
[Assistant tool call]: edit(path="report.txt", oldString="a", newString="b")
Rekapitulasi transaksi harian berhasil diselesaikan.
    `;

    const cleaned = normalizer.cleanseAssistantMessageForHistory(dirtyHistory);

    expect(cleaned).not.toContain('<think>');
    expect(cleaned).not.toContain('Internal chain of thought');
    expect(cleaned).not.toContain('[Assistant tool call]');
    expect(cleaned).toContain(
      'Rekapitulasi transaksi harian berhasil diselesaikan.',
    );
  });
});
