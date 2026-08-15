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
  ) => AsyncGenerator<StreamChunk>;
  getNextProvider: (currentId: string, triedIds?: string[]) => Promise<ProviderConfig | null>;
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
        const chunks = options.makeRequest(provider, options.body);

        if (provider.id !== 'env-fallback' && options.recordUsage) {
          await options.recordUsage(provider.id).catch(() => {});
        }

        let anyChunk = false;
        for await (const chunk of chunks) {
          anyChunk = true;
          if (chunk.type === 'error') {
            yield chunk;
            return;
          }
          if (chunk.type === 'done') {
            yield chunk;
            return;
          }
          yield chunk;
        }

        if (!anyChunk) {
          console.warn(`[streamWithFallback] Empty stream from provider ${provider.name} (${provider.model})`);
          lastError = 'Empty stream (no chunks received)';
          if (provider.id !== 'env-fallback' && options.recordError) {
            await options.recordError(provider.id, lastError.substring(0, 200)).catch(() => {});
          }
          if (provider.id !== 'env-fallback' && options.setCooldown) {
            await options.setCooldown(provider.id, 60).catch(() => {});
          }
          break;
        }

        yield { type: 'done' };
        return;
      } catch (err: any) {
        console.error(`[streamWithFallback ERROR] Provider ${provider.name} (${provider.model}):`, err?.message, 'statusCode:', err?.statusCode, 'responseBody:', err?.responseBody, err?.cause);
        const statusCode = err?.statusCode ?? 0;
        const errorBody =
          (err?.responseBody as string) ?? err?.body ?? err?.message ?? '';
        lastError = err?.message || 'unknown error';

        // Network/timeout errors carry no status code → retry with backoff.
        if (statusCode === 0) {
          if (err?.isTimeout) {
            // A hang (no first token) won't heal with a retry — rotate
            // immediately and cooldown the model so later rounds skip it.
            lastError = `Timeout: ${err?.message || 'provider did not respond'}`;
            if (provider.id !== 'env-fallback' && options.recordError) {
              await options.recordError(provider.id, lastError.substring(0, 200)).catch(() => {});
            }
            if (provider.id !== 'env-fallback' && options.setCooldown) {
              await options.setCooldown(provider.id, 300).catch(() => {});
            }
            break;
          }
          retryCount++;
          if (retryCount < MAX_RETRIES_PER_PROVIDER) {
            await jitteredBackoff(retryCount);
            continue;
          }
          break;
        }

        const isContextOverflow =
          statusCode === 413 ||
          /context_length_exceeded|maximum context length|prompt is too long|token limit/i.test(errorBody);

        if (isContextOverflow && Array.isArray(options.body.messages) && options.body.messages.length > 2) {
          options.body.messages = emergencyCompactMessages(options.body.messages);
          retryCount++;
          if (retryCount < MAX_RETRIES_PER_PROVIDER) {
            await jitteredBackoff(retryCount);
            continue;
          }
        }

        const classified = options.classifyError(statusCode, errorBody);
        lastError = classified.message || `HTTP ${statusCode}`;

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
      }
    }

    rotationCount++;
    if (rotationCount > MAX_ROTATIONS) break;

    const nextProvider = await options.getNextProvider(provider.id, Array.from(triedProviders));
    if (!nextProvider) break;

    triedProviders.add(nextProvider.id);
    provider = nextProvider;
  }

  yield { type: 'error', error: `All providers exhausted. Last error: ${lastError || 'unknown'}` };
}

function emergencyCompactMessages(messages: any[]): any[] {
  if (!Array.isArray(messages) || messages.length <= 2) return messages;

  const system = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  // Prune all tool results to max 500 chars
  const pruned = nonSystem.map((msg) => {
    if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 500) {
      return {
        ...msg,
        content: msg.content.substring(0, 500) + '\n[...truncated for context recovery]',
      };
    }
    return msg;
  });

  // Keep first message + last 3 messages, summarizing the rest
  if (pruned.length > 4) {
    const head = pruned.slice(0, 1);
    const tail = pruned.slice(-3);
    const middleCount = pruned.length - 4;
    return [
      ...system,
      ...head,
      {
        role: 'system',
        content: `[Context Recovery: ${middleCount} earlier messages compacted to fit token limit]`,
      },
      ...tail,
    ];
  }

  return [...system, ...pruned];
}

async function jitteredBackoff(retryCount: number): Promise<void> {
  const baseDelay = 1000;
  const jitter = Math.random() * 1000;
  const delay = baseDelay * Math.pow(2, retryCount) + jitter;
  await new Promise((resolve) => setTimeout(resolve, delay));
}
