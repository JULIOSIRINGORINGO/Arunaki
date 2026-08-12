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
          lastError = 'Empty stream (no chunks received)';
          retryCount++;
          if (retryCount < MAX_RETRIES_PER_PROVIDER) {
            await jitteredBackoff(retryCount);
            continue;
          }
          break;
        }

        yield { type: 'done' };
        return;
      } catch (err: any) {
        const statusCode = err?.statusCode ?? 0;
        const errorBody =
          (err?.responseBody as string) ?? err?.body ?? err?.message ?? '';
        lastError = err?.message || 'unknown error';

        // Network/timeout errors carry no status code → retry with backoff.
        if (statusCode === 0) {
          retryCount++;
          if (retryCount < MAX_RETRIES_PER_PROVIDER) {
            await jitteredBackoff(retryCount);
            continue;
          }
          break;
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

    const nextProvider = await options.getNextProvider(provider.id);
    if (!nextProvider) break;

    triedProviders.add(nextProvider.id);
    provider = nextProvider;
  }

  yield { type: 'error', error: `All providers exhausted. Last error: ${lastError || 'unknown'}` };
}

async function jitteredBackoff(retryCount: number): Promise<void> {
  const baseDelay = 1000;
  const jitter = Math.random() * 1000;
  const delay = baseDelay * Math.pow(2, retryCount) + jitter;
  await new Promise((resolve) => setTimeout(resolve, delay));
}
