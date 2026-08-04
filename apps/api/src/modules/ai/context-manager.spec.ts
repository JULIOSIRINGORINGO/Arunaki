import { describe, it, expect } from 'vitest';
import { ContextManager } from './context-manager.js';
import { ChatMessage } from './ai.service.js';

function toolMessage(content: string): ChatMessage {
  return { role: 'tool', content, tool_call_id: 't1', name: 'read_workspace_file' };
}

describe('ContextManager — preemptive compaction guards', () => {
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
});
