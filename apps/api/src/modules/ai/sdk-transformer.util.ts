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
  model: string,
  reasoningEffortOverride?: string,
): Record<string, any> | undefined {
  const effort = reasoningEffortOverride || getModelCapability(model).reasoningEffort;
  if (!effort) return undefined;
  return provider.type === 'anthropic'
    ? { anthropic: { thinking: { type: 'enabled', budgetTokens: 2048 } } }
    : { openai: { reasoningEffort: effort } };
}

export async function makeSdkRequest(
  provider: ProviderConfig,
  body: Record<string, any>,
  timeoutMs = 180000,
): Promise<{ data: any; statusCode: number }> {
  const canUseTools = (body.tools?.length ?? 0) > 0;
  const data = await generateText({
    model: getSdkModel(provider),
    messages: toSdkMessages(body.messages),
    allowSystemInMessages: true,
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
  const firstTokenTimeoutMs = options.firstTokenTimeoutMs ?? 20000;
  const totalTimeoutMs = options.totalTimeoutMs ?? 60000;

  const controller = new AbortController();
  let gotFirstToken = false;
  const firstTokenTimer = setTimeout(() => controller.abort(), firstTokenTimeoutMs);
  const totalTimer = setTimeout(() => controller.abort(), totalTimeoutMs);

  const result = streamText({
    model: getSdkModel(provider),
    messages: toSdkMessages(body.messages),
    allowSystemInMessages: true,
    temperature: body.temperature ?? 0.7,
    maxOutputTokens: body.maxOutputTokens ?? scaleMaxTokens(provider.model),
    abortSignal: controller.signal,
    ...(canUseTools ? { tools: toSdkTools(body.tools) } : {}),
    ...(body.providerOptions ? { providerOptions: body.providerOptions } : {}),
    maxRetries: 0,
  });

  try {
    for await (const part of result.stream) {
      if (!gotFirstToken) {
        gotFirstToken = true;
        clearTimeout(firstTokenTimer);
      }
      if (part.type === 'text-delta') {
        const content = (part as any).textDelta ?? (part as any).text;
        if (content) yield { type: 'content', content };
      } else if (part.type === 'tool-call') {
        const rawArgs = (part as any).args ?? (part as any).input ?? {};
        yield {
          type: 'tool_call',
          toolCall: {
            id: (part as any).toolCallId,
            name: (part as any).toolName,
            arguments:
              typeof rawArgs === 'string'
                ? rawArgs
                : JSON.stringify(rawArgs),
          },
        };
      } else if (part.type === 'finish') {
        done = true;
        break;
      } else if (part.type === 'error') {
        throw (part as any).error;
      }
    }
  } catch (err: any) {
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

  if (!done) {
    throw new Error('Stream ended without a finish event');
  }
}
