import { ProviderConfig } from '../provider/provider.service.js';

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  error?: string;
}

export interface StreamFallbackOptions {
  provider: ProviderConfig;
  body: Record<string, any>;
  makeRequest: (
    provider: ProviderConfig,
    body: Record<string, any>,
  ) => Promise<{ response: Response; statusCode: number }>;
  getNextProvider: (currentId: string) => Promise<ProviderConfig | null>;
  classifyError: (
    statusCode: number,
    body: string,
  ) => { action: 'retry' | 'rotate' | 'fatal'; message?: string; cooldownSeconds?: number };
  recordUsage?: (providerId: string) => Promise<void>;
  recordError?: (providerId: string, error: string) => Promise<void>;
  setCooldown?: (providerId: string, seconds: number) => Promise<void>;
}

const MAX_RETRIES_PER_PROVIDER = 3;
const MAX_ROTATIONS = 3;

export async function* streamWithFallback(
  options: StreamFallbackOptions,
): AsyncGenerator<StreamChunk> {
  let provider = options.provider;
  const triedProviders = new Set<string>([provider.id]);
  let rotationCount = 0;
  let lastError: string | undefined;

  while (rotationCount <= MAX_ROTATIONS) {
    let retryCount = 0;

    while (retryCount < MAX_RETRIES_PER_PROVIDER) {
      try {
        const requestBody = { ...options.body, model: provider.model, stream: true };
        const { response, statusCode } = await options.makeRequest(
          provider,
          requestBody,
        );

        if (response.ok) {
          if (provider.id !== 'env-fallback' && options.recordUsage) {
            await options.recordUsage(provider.id).catch(() => {});
          }

          for await (const chunk of parseSSEStream(response)) {
            if (chunk.type === 'content') {
              yield chunk;
            } else if (chunk.type === 'tool_call') {
              yield chunk;
            } else if (chunk.type === 'done') {
              yield chunk;
              return;
            }
          }
          yield { type: 'done' };
          return;
        }

        const errorBody = await response.text();
        const classified = options.classifyError(statusCode, errorBody);
        lastError = classified.message || `HTTP ${statusCode}: ${errorBody.substring(0, 150)}`;

        if (provider.id !== 'env-fallback' && options.recordError) {
          await options.recordError(
            provider.id,
            `HTTP ${statusCode}: ${errorBody.substring(0, 200)}`,
          ).catch(() => {});
        }

        if (classified.action === 'retry') {
          retryCount++;
          if (retryCount < MAX_RETRIES_PER_PROVIDER) {
            await jitteredBackoff(retryCount);
            continue;
          }
          break;
        }

        if (classified.action === 'rotate') {
          if (provider.id !== 'env-fallback' && classified.cooldownSeconds && options.setCooldown) {
            await options.setCooldown(provider.id, classified.cooldownSeconds).catch(() => {});
          }
          break;
        }

        if (classified.action === 'fatal') {
          yield { type: 'error', error: classified.message };
          return;
        }
      } catch (err: any) {
        lastError = err.message;
        retryCount++;
        if (retryCount < MAX_RETRIES_PER_PROVIDER) {
          await jitteredBackoff(retryCount);
          continue;
        }
        break;
      }
    }

    rotationCount++;
    if (rotationCount > MAX_ROTATIONS) break;

    const nextProvider = await options.getNextProvider(provider.id);
    if (!nextProvider) break;

    triedProviders.add(nextProvider.id);
    provider = nextProvider;
  }

  yield { type: 'error', error: `All providers exhausted. Last error: ${lastError || 'unknown'}` };
}

async function* parseSSEStream(response: Response): AsyncGenerator<StreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: tc.id || '',
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  },
                };
              }
            }
            if (choice.finish_reason) {
              yield { type: 'done' };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function jitteredBackoff(retryCount: number): Promise<void> {
  const baseDelay = 1000;
  const jitter = Math.random() * 1000;
  const delay = baseDelay * Math.pow(2, retryCount) + jitter;
  await new Promise((resolve) => setTimeout(resolve, delay));
}