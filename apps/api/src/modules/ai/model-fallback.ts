import { Logger } from '@nestjs/common';

export interface FallbackAttempt {
  providerId: string;
  providerName: string;
  retry: number;
  rotation: number;
  outcome: 'success' | 'retry' | 'rotate' | 'fatal';
  statusCode?: number;
  error?: string;
}

export interface FallbackResult {
  data: any;
  model: string;
  attempts: FallbackAttempt[];
}

export interface FallbackProvider {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  type: string;
}

export interface FallbackOptions {
  provider: FallbackProvider;
  body: Record<string, any>;
  makeRequest: (
    provider: FallbackProvider,
    body: Record<string, any>,
  ) => Promise<{ data: any; statusCode: number }>;
  getNextProvider: (currentId: string, triedIds?: string[]) => Promise<FallbackProvider | null>;
  classifyError: (
    statusCode: number,
    body: string,
  ) => { action: 'retry' | 'rotate' | 'fatal'; message?: string; cooldownSeconds?: number };
  recordUsage?: (providerId: string) => Promise<void>;
  recordError?: (providerId: string, error: string) => Promise<void>;
  setCooldown?: (providerId: string, seconds: number) => Promise<void>;
  logger?: Logger;
}

const MAX_RETRIES_PER_PROVIDER = 3;
const MAX_ROTATIONS = 3;

export async function runWithModelFallback(
  options: FallbackOptions,
): Promise<FallbackResult> {
  const log = options.logger ?? new Logger('ModelFallback');
  let provider = options.provider;
  const triedProviders = new Set<string>([provider.id]);
  const attempts: FallbackAttempt[] = [];
  let lastError: string | undefined;
  let rotationCount = 0;

  while (rotationCount <= MAX_ROTATIONS) {
    let retryCount = 0;

    while (retryCount < MAX_RETRIES_PER_PROVIDER) {
      try {
        log.log(
          `[${provider.name}] Request attempt (retry=${retryCount}, rotation=${rotationCount})`,
        );

        const { data } = await options.makeRequest(provider, options.body);

        if (provider.id !== 'env-fallback' && options.recordUsage) {
          await options.recordUsage(provider.id).catch(() => {});
        }

        attempts.push({
          providerId: provider.id,
          providerName: provider.name,
          retry: retryCount,
          rotation: rotationCount,
          outcome: 'success',
        });

        return {
          data,
          model: data?.modelId ?? data?.model ?? provider.model,
          attempts,
        };
      } catch (err: any) {
        lastError = err?.message || 'unknown error';

        const statusCode = err?.statusCode ?? 0;
        const errorBody =
          (err?.responseBody as string) ?? err?.body ?? err?.message ?? '';

        // Network/timeout errors carry no status code → retry with backoff.
        if (statusCode === 0) {
          if (err?.isTimeout) {
            // A hang (no first token) won't heal with a retry — rotate
            // immediately and cooldown the model so later rounds skip it.
            lastError = `Timeout: ${err?.message || 'provider did not respond'}`;
            log.warn(`[${provider.name}] ${lastError}`);
            attempts.push({
              providerId: provider.id,
              providerName: provider.name,
              retry: retryCount,
              rotation: rotationCount,
              outcome: 'rotate',
              error: lastError,
            });
            if (provider.id !== 'env-fallback' && options.recordError) {
              await options.recordError(provider.id, lastError.substring(0, 200)).catch(() => {});
            }
            if (provider.id !== 'env-fallback' && options.setCooldown) {
              await options.setCooldown(provider.id, 300).catch(() => {});
            }
            break;
          }
          log.warn(`[${provider.name}] Network error: ${lastError}`);
          attempts.push({
            providerId: provider.id,
            providerName: provider.name,
            retry: retryCount,
            rotation: rotationCount,
            outcome: 'retry',
            error: lastError,
          });
          retryCount++;
          if (retryCount < MAX_RETRIES_PER_PROVIDER) {
            await jitteredBackoff(retryCount);
            continue;
          }
          break;
        }

        const classified = options.classifyError(statusCode, errorBody);
        lastError = classified.message || `HTTP ${statusCode}`;

        log.warn(
          `[${provider.name}] HTTP ${statusCode} → action: ${classified.action}`,
        );

        attempts.push({
          providerId: provider.id,
          providerName: provider.name,
          retry: retryCount,
          rotation: rotationCount,
          outcome: classified.action,
          statusCode,
          error: classified.message,
        });

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
          await new Promise((r) => setTimeout(r, 5000));
          break;
        }

        if (classified.action === 'fatal') {
          throw new Error(classified.message);
        }
      }
    }

    rotationCount++;
    if (rotationCount > MAX_ROTATIONS) break;

    const nextProvider = await options.getNextProvider(provider.id, Array.from(triedProviders));
    if (!nextProvider) {
      log.log('No more available providers for rotation');
      break;
    }

    log.log(
      `Rotating: ${provider.name} → ${nextProvider.name} (rotation ${rotationCount}/${MAX_ROTATIONS})`,
    );
    triedProviders.add(nextProvider.id);
    provider = nextProvider;
  }

  throw new Error(
    `All providers exhausted after ${rotationCount} rotations. Last error: ${lastError || 'unknown'}`,
  );
}

async function jitteredBackoff(retryCount: number): Promise<void> {
  const baseDelay = 1000;
  const jitter = Math.random() * 1000;
  const delay = baseDelay * Math.pow(2, retryCount) + jitter;
  await new Promise((resolve) => setTimeout(resolve, delay));
}
