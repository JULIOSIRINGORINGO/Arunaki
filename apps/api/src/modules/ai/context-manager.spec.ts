import { describe, it, expect } from 'vitest';
import { ContextManager } from './context-manager.js';
import { ChatMessage } from './ai.service.js';
import { countTokens } from './tokenizer.js';

function toolMessage(content: string): ChatMessage {
  return { role: 'tool', content, tool_call_id: 't1', name: 'read' };
}

describe('ContextManager — preemptive compaction guards', () => {
  describe('estimateTokens uses the real tokenizer', () => {
    it('counts Indonesian prose with tiktoken, not the char/4 heuristic', () => {
      const cm = new ContextManager();
      const id = `Laporan keuangan bulan ini menunjukkan peningkatan penjualan sebesar 15 persen dibandingkan periode sebelumnya. Kami mencatat total pendapatan Rp 250.000.000 dan biaya operasional Rp 180.000.000, sehingga laba bersih mencapai Rp 70.000.000. Rekomendasi kami adalah meningkatkan alokasi pemasaran digital dan memperkuat layanan pelanggan.`.repeat(20);
      const msgs: ChatMessage[] = [{ role: 'user', content: id }];
      const total = cm.estimateTokens(msgs);
      // 4 per-message overhead + exact tokenizer count (not char/4)
      expect(total).toBe(4 + countTokens(id));
    });

    it('counts JSON tool results with tiktoken (denser than prose)', () => {
      const cm = new ContextManager();
      const json = JSON.stringify(
        Array.from({ length: 200 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          price: 1000 + i,
          qty: 3,
          note: 'contoh data penjualan',
        })),
      );
      const msgs: ChatMessage[] = [toolMessage(json)];
      const total = cm.estimateTokens(msgs);
      expect(total).toBe(4 + countTokens(json));
      expect(total).toBeGreaterThan(Math.ceil(json.length / 4));
    });
  });
  describe('enforceAggregateToolResultBudget', () => {
    it('keeps messages unchanged when total tool chars are within the 50% share', () => {
      const cm = new ContextManager();
      const msgs: ChatMessage[] = [
        { role: 'system', content: 'sys' },
        toolMessage('a'.repeat(1000)),
        toolMessage('b'.repeat(1000)),
      ];
      const { messages, truncatedCount } =
        cm.enforceAggregateToolResultBudget(msgs, 32000);
      expect(truncatedCount).toBe(0);
      expect(messages).toBe(msgs);
    });

    it('truncates the oldest tool results first and keeps the last 3 intact', () => {
      const cm = new ContextManager();
      const big = 'x'.repeat(20000);
      const msgs: ChatMessage[] = [
        toolMessage(big), // oldest — should be truncated
        toolMessage(big),
        toolMessage(big),
        toolMessage(big),
        toolMessage('fresh1'),
        toolMessage('fresh2'),
        toolMessage('fresh3'),
      ];
      const { messages, truncatedCount } =
        cm.enforceAggregateToolResultBudget(msgs, 32000);
      // share = 32000*4*0.5 = 64000 chars; 4*20000 = 80000 > 64000
      expect(truncatedCount).toBe(1);
      expect(messages[0].content).toContain('[Old tool output cleared');
      expect(messages[1].content).toBe(big);
      expect(messages[6].content).toBe('fresh3');
      expect(messages[5].content).toBe('fresh2');
    });
  });

  describe('estimatePromptTokens', () => {
    it('weights tool results denser (2 chars/token) than prose (4 chars/token)', () => {
      const cm = new ContextManager();
      const plain: ChatMessage[] = [
        { role: 'user', content: 'a'.repeat(4000) },
      ];
      const tools: ChatMessage[] = [toolMessage('a'.repeat(4000))];
      const plainTokens = cm.estimatePromptTokens(plain);
      const toolTokens = cm.estimatePromptTokens(tools);
      expect(plainTokens).toBe(1012); // 12 overhead + 4000/4
      expect(toolTokens).toBe(2012); // 12 overhead + 4000/2
      expect(toolTokens).toBeGreaterThan(plainTokens);
    });
  });

  describe('compress with model context override', () => {
    it('compresses when over the model threshold but under the default 128K threshold', async () => {
      const cm = new ContextManager();
      const msgs: ChatMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'goal' },
        ...Array.from({ length: 20 }, (_, i) => [
          toolMessage(`result ${i} `.repeat(300)), // ~4.5K chars each
          { role: 'user', content: `follow-up ${i}` },
        ]).flat(),
      ];
      // Default threshold (128K * 0.25 = 32K tokens): ~20 * (4.5K/2) = 45K tokens → compressed
      const compressed = await cm.compress(msgs, 32000);
      expect(compressed.length).toBeLessThan(msgs.length);
    });
  });

  describe('estimateToolResultReduction', () => {
    it('counts only prunable chars for oversized results beyond the last 3', () => {
      const cm = new ContextManager();
      const msgs: ChatMessage[] = [
        toolMessage('x'.repeat(5000)),
        toolMessage('x'.repeat(5000)),
        toolMessage('x'.repeat(5000)),
        toolMessage('x'.repeat(5000)),
        toolMessage('short'),
        toolMessage('short'),
      ];
      // last 3 = [3, 4, 5] → indices 0-2 prunable: 3 * (5000 - (250 + 80)) = 14010
      expect(cm.estimateToolResultReduction(msgs)).toBe(14010);
    });

    it('returns 0 when 3 or fewer tool results exist', () => {
      const cm = new ContextManager();
      const msgs: ChatMessage[] = [
        toolMessage('x'.repeat(5000)),
        toolMessage('x'.repeat(5000)),
        toolMessage('x'.repeat(5000)),
      ];
      expect(cm.estimateToolResultReduction(msgs)).toBe(0);
    });
  });

  describe('truncateToolResultsOnly', () => {
    it('prunes oversized results but keeps the last 3 intact', () => {
      const cm = new ContextManager();
      const big = 'x'.repeat(5000);
      const msgs: ChatMessage[] = [
        toolMessage(big),
        toolMessage(big),
        toolMessage(big),
        toolMessage(big),
        toolMessage('fresh1'),
        toolMessage('fresh2'),
      ];
      const result = cm.truncateToolResultsOnly(msgs);
      expect(result[0].content).toContain('[Old tool output cleared');
      expect(result[3].content).toBe(big);
      expect(result[5].content).toBe('fresh2');
    });
  });

  describe('stripThinkingFromContext', () => {
    it('removes think blocks from old assistant messages but keeps the latest', () => {
      const cm = new ContextManager();
      const msgs: ChatMessage[] = [
        { role: 'assistant', content: '<think>old reasoning</think>answer one' },
        { role: 'tool', content: 'result' },
        { role: 'assistant', content: '<think>latest reasoning</think>answer two' },
      ];
      const result = cm.stripThinkingFromContext(msgs);
      expect(result[0].content).toBe('answer one');
      expect(result[2].content).toBe('<think>latest reasoning</think>answer two');
    });

    it('returns the same reference when nothing changes', () => {
      const cm = new ContextManager();
      const msgs: ChatMessage[] = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ];
      expect(cm.stripThinkingFromContext(msgs)).toBe(msgs);
    });
  });
});
