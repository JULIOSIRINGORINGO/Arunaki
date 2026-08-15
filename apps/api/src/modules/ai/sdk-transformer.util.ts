import { ToolSet, tool, jsonSchema, generateText, streamText } from 'ai';
import type { ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { ChatMessage, ToolDefinition } from './ai.service.js';
import type { ProviderConfig } from '../provider/provider.service.js';
import type { StreamChunk } from './stream-chat.js';
import { getModelCapability, scaleMaxTokens } from './model-capability.js';

const sdkProviders = new Map<string, any>();

export function getSdkModel(provider: ProviderConfig): any {
  const key = `${provider.type}|${provider.baseUrl}|${provider.apiKey}|${provider.model}`;
  let sdk = sdkProviders.get(key);
  if (!sdk) {
    const headers: Record<string, string> = {};
    if (provider.baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://arunaki.app';
      headers['X-Title'] = 'Arunaki AI Assistant';
    }
    if (provider.headerPrefix) headers['HTTP-Referer'] = provider.headerPrefix;
    if (provider.headerTitle) headers['X-Title'] = provider.headerTitle;

    if (provider.type === 'anthropic') {
      sdk = createAnthropic({ baseURL: provider.baseUrl, apiKey: provider.apiKey, headers });
    } else {
      sdk = createOpenAI({ baseURL: provider.baseUrl, apiKey: provider.apiKey, headers });
    }
    sdkProviders.set(key, sdk);
  }
  return sdk.chat(provider.model);
}

export function extractSystemAndMessages(messages: ChatMessage[]): {
  system?: string;
  messages: ModelMessage[];
} {
  const systemParts: string[] = [];
  const modelMessages: ModelMessage[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      if (m.content) systemParts.push(m.content);
    } else if (m.role === 'user') {
      modelMessages.push({ role: 'user', content: m.content ?? '' } as ModelMessage);
    } else if (m.role === 'assistant') {
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
      modelMessages.push({ role: 'assistant', content: parts } as ModelMessage);
    } else if (m.role === 'tool') {
      modelMessages.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: m.tool_call_id ?? '',
            toolName: m.name ?? '',
            output: { type: 'text', value: m.content ?? '' },
          },
        ],
      } as ModelMessage);
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: modelMessages,
  };
}

export function toSdkMessages(messages: ChatMessage[]): ModelMessage[] {
  return extractSystemAndMessages(messages).messages;
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
  model: string,
  reasoningEffortOverride?: string,
): Record<string, any> | undefined {
  const effort = reasoningEffortOverride || getModelCapability(model).reasoningEffort;
  if (!effort) return undefined;
  if (provider.type === 'anthropic') {
    return { anthropic: { thinking: { type: 'enabled', budgetTokens: 2048 } } };
  }
  const norm = (model || '').toLowerCase();
  if (norm.startsWith('o1') || norm.startsWith('o3')) {
    return { openai: { reasoningEffort: effort } };
  }
  return undefined;
}

export async function makeSdkRequest(
  provider: ProviderConfig,
  body: Record<string, any>,
  timeoutMs = 180000,
): Promise<{ data: any; statusCode: number }> {
  const canUseTools = (body.tools?.length ?? 0) > 0;
  const { system, messages } = extractSystemAndMessages(body.messages);
  const data = await generateText({
    model: getSdkModel(provider),
    ...(system ? { system } : {}),
    messages,
    temperature: body.temperature ?? 0.7,
    maxOutputTokens: body.maxOutputTokens ?? scaleMaxTokens(provider.model),
    ...(canUseTools ? { tools: toSdkTools(body.tools) } : {}),
    ...(body.providerOptions ? { providerOptions: body.providerOptions } : {}),
    maxRetries: 0,
    timeout: timeoutMs,
  });
  return { data, statusCode: 200 };
}

export async function *makeSdkRequestStream(
  provider: ProviderConfig,
  body: Record<string, any>,
  options: { firstTokenTimeoutMs?: number; totalTimeoutMs?: number } = {},
): AsyncGenerator<StreamChunk> {
  const canUseTools = (body.tools?.length ?? 0) > 0;
  let done = false;

  // Time to first token (TTFB) timeout catches a hung provider fast; the
  // total timeout guards against a slow/stalled generation so a sluggish
  // model gets rotated to a faster sibling model automatically.
  const firstTokenTimeoutMs = options.firstTokenTimeoutMs ?? 65000;
  const totalTimeoutMs = options.totalTimeoutMs ?? 120000;

  console.log(`[makeSdkRequestStream] Starting stream to ${provider.name} (${provider.model}), messages: ${body.messages?.length}, tools: ${body.tools?.length}`);

  const controller = new AbortController();
  let gotFirstToken = false;
  const firstTokenTimer = setTimeout(() => {
    console.warn(`[makeSdkRequestStream] TTFB timeout after ${firstTokenTimeoutMs}ms`);
    controller.abort();
  }, firstTokenTimeoutMs);
  const totalTimer = setTimeout(() => {
    console.warn(`[makeSdkRequestStream] Total timeout after ${totalTimeoutMs}ms`);
    controller.abort();
  }, totalTimeoutMs);

  const { system, messages } = extractSystemAndMessages(body.messages);

  const result = streamText({
    model: getSdkModel(provider),
    ...(system ? { system } : {}),
    messages,
    temperature: body.temperature ?? 0.7,
    maxOutputTokens: body.maxOutputTokens ?? scaleMaxTokens(provider.model),
    abortSignal: controller.signal,
    ...(canUseTools ? { tools: toSdkTools(body.tools) } : {}),
    ...(body.providerOptions ? { providerOptions: body.providerOptions } : {}),
    maxRetries: 0,
  });

  const pendingToolCalls = new Map<string, { id: string; name: string; args: string }>();

  try {
    for await (const part of result.fullStream) {
      if (!gotFirstToken) {
        gotFirstToken = true;
        clearTimeout(firstTokenTimer);
      }
      if (part.type === 'text-delta') {
        const content = (part as any).text ?? (part as any).textDelta;
        if (content) yield { type: 'content', content };
      } else if ((part as any).type === 'reasoning' || (part as any).type === 'reasoning-delta') {
        const reasoning = (part as any).text ?? (part as any).reasoningDelta ?? (part as any).textDelta;
        if (reasoning) yield { type: 'reasoning', content: reasoning };
      } else if (part.type === 'tool-input-start') {
        pendingToolCalls.set(part.id, {
          id: part.id,
          name: (part as any).toolName,
          args: '',
        });
      } else if (part.type === 'tool-input-delta') {
        const pending = pendingToolCalls.get(part.id);
        if (pending) {
          pending.args += (part as any).delta ?? (part as any).argsTextDelta ?? '';
        }
      } else if (part.type === 'tool-call') {
        const rawArgs = (part as any).args ?? (part as any).input ?? {};
        yield {
          type: 'tool_call',
          toolCall: {
            id: (part as any).toolCallId ?? (part as any).id,
            name: (part as any).toolName,
            arguments:
              typeof rawArgs === 'string'
                ? rawArgs
                : JSON.stringify(rawArgs),
          },
        };
        pendingToolCalls.delete((part as any).toolCallId ?? (part as any).id);
      } else if (part.type === 'finish' || part.type === 'finish-step') {
        for (const [, pending] of pendingToolCalls.entries()) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: pending.id,
              name: pending.name,
              arguments: pending.args,
            },
          };
        }
        pendingToolCalls.clear();
        if (part.type === 'finish') {
          done = true;
          break;
        }
      } else if (part.type === 'error') {
        console.error('[makeSdkRequestStream part error]', (part as any).error);
        throw (part as any).error;
      }
    }

    // Flush any trailing pending tool calls if stream ended without finish part
    for (const [, pending] of pendingToolCalls.entries()) {
      yield {
        type: 'tool_call',
        toolCall: {
          id: pending.id,
          name: pending.name,
          arguments: pending.args,
        },
      };
    }
    pendingToolCalls.clear();
  } catch (err: any) {
    console.error('[makeSdkRequestStream caught]', err?.message, 'aborted:', controller.signal.aborted);
    if (controller.signal.aborted) {
      const timeoutErr = new Error(
        gotFirstToken
          ? `LLM stream stalled after ${totalTimeoutMs}ms`
          : `LLM provider did not respond within ${firstTokenTimeoutMs}ms (timeout)`,
      );
      (timeoutErr as any).statusCode = 0;
      (timeoutErr as any).isTimeout = true;
      (timeoutErr as any).name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(firstTokenTimer);
    clearTimeout(totalTimer);
  }

  if (!done && !gotFirstToken) {
    throw new Error('Stream ended without a finish event or any tokens');
  }
}
