import { ToolSet, tool, jsonSchema } from 'ai';
import type { ModelMessage } from 'ai';
import type { ChatMessage, ToolDefinition } from './ai.service.js';

export function toSdkMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (m.role === 'system') {
      return { role: 'system', content: m.content ?? '' } as ModelMessage;
    }
    if (m.role === 'user') {
      return { role: 'user', content: m.content ?? '' } as ModelMessage;
    }
    if (m.role === 'assistant') {
      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
      > = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls ?? []) {
        let input: unknown;
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          input = tc.function.arguments;
        }
        parts.push({
          type: 'tool-call',
          toolCallId: tc.id,
          toolName: tc.function.name,
          input,
        });
      }
      return { role: 'assistant', content: parts } as ModelMessage;
    }
    return {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: m.tool_call_id ?? '',
          toolName: m.name ?? '',
          output: { type: 'text', value: m.content ?? '' },
        },
      ],
    } as ModelMessage;
  });
}

export function toSdkTools(tools: ToolDefinition[]): ToolSet {
  const sdk: ToolSet = {};
  for (const t of tools) {
    const fn = t.function;
    sdk[fn.name] = tool({
      description: fn.description,
      inputSchema: jsonSchema(fn.parameters),
    });
  }
  return sdk;
}

export function buildProviderOptions(
  provider: { type?: string; model?: string },
  modelCapabilities: any,
): Record<string, any> | undefined {
  const caps = modelCapabilities.getCapabilities(provider.model || '');
  if (!caps.reasoning) return undefined;
  return {
    openai: { reasoningEffort: 'medium' },
  };
}
