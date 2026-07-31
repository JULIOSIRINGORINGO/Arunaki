import { Injectable, Logger } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { ProviderRepository } from './provider.repository.js';

export interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headerPrefix?: string;
  headerTitle?: string;
}

/**
 * Error classification result.
 * - retry: temporary error, retry SAME provider with backoff
 * - rotate: credential/rate-limit error, switch to NEXT provider
 * - fatal: unrecoverable error, stop immediately
 */
export type ErrorAction = 'retry' | 'rotate' | 'fatal';

export interface ClassifiedError {
  action: ErrorAction;
  statusCode: number;
  message: string;
  cooldownSeconds?: number; // For rotate: how long to cooldown the provider
}

@Injectable()
export class ProviderService extends BaseService<Provider> {
  private readonly logger = new Logger(ProviderService.name);

  // Cooldown durations per error type (seconds)
  private readonly COOLDOWN = {
    '429': 20, // Rate limit: 20 seconds cooldown
    '402': 300, // Payment required: 5 minutes
    '401': 300, // Auth error: 5 minutes
    '403': 300, // Forbidden: 5 minutes
    '400': 5, // Bad request: 5 seconds (quick retry)
    '500': 10, // Server error: 10 seconds
    '502': 10, // Bad gateway: 10 seconds
    '503': 20, // Service unavailable: 20 seconds
  };

  constructor(protected readonly repository: ProviderRepository) {
    super(repository);
  }

  async findActive(): Promise<Provider | null> {
    return this.repository.findActive();
  }

  async findAllEnabled(): Promise<Provider[]> {
    return this.repository.findAllEnabled();
  }

  async getActiveConfig(): Promise<ProviderConfig | null> {
    const provider = await this.repository.findActive();
    if (!provider) return null;

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.model,
      headerPrefix: provider.headerPrefix || undefined,
      headerTitle: provider.headerTitle || undefined,
    };
  }

  async setActive(id: string): Promise<void> {
    await this.repository.setActive(id);
  }

  async recordUsage(id: string): Promise<void> {
    await this.repository.recordUsage(id);
  }

  async recordError(id: string, errorMessage: string): Promise<void> {
    await this.repository.recordError(id, errorMessage);
  }

  /**
   * Classify an HTTP error code into an action.
   *
   * 5xx (except 503) → retry (same provider, backoff)
   * 429, 413, 402, 401, 403, 503, 404, 400 → rotate (switch provider/model, cooldown)
   * Other → fatal
   */
  classifyError(statusCode: number, body: string): ClassifiedError {
    const message = `HTTP ${statusCode}`;

    // 5xx server errors → retry with backoff (don't rotate yet)
    if (statusCode >= 500 && statusCode < 600 && statusCode !== 503) {
      return {
        action: 'retry',
        statusCode,
        message,
      };
    }

    // 429, 413, 402, 401, 403, 503, 404, 400 → rotate to next provider/model
    if ([429, 413, 402, 401, 403, 503, 404, 400].includes(statusCode)) {
      const cooldownKey = String(statusCode) as keyof typeof this.COOLDOWN;
      return {
        action: 'rotate',
        statusCode,
        message: `${message}: ${body.substring(0, 150)}`,
        cooldownSeconds: this.COOLDOWN[cooldownKey] || 30,
      };
    }

    // Other errors → fatal
    return {
      action: 'fatal',
      statusCode,
      message: `${message}: ${body.substring(0, 200)}`,
    };
  }

  // Built-in fallback free models pool on OpenRouter (100% verified active free models)
  private static readonly FREE_MODEL_CANDIDATES = [
    'openrouter/free',
    'openrouter/auto',
  ];

  /**
   * Get next available provider/model for rotation.
   * Returns the first provider not in cooldown, or falls back to next free model candidate pool.
   */
  async getNextAvailable(
    currentProviderId?: string,
  ): Promise<ProviderConfig | null> {
    const available: Provider[] = await this.repository.findAvailable().catch(() => []);

    // Skip the current provider (we're rotating AWAY from it)
    const next = available.find((p) => p.id !== currentProviderId);

    if (next) {
      return {
        id: next.id,
        name: next.name,
        type: next.type,
        baseUrl: next.baseUrl,
        apiKey: next.apiKey,
        model: next.model,
        headerPrefix: next.headerPrefix || undefined,
        headerTitle: next.headerTitle || undefined,
      };
    }

    // Fallback: rotate across built-in free models on OpenRouter
    const pool = ProviderService.FREE_MODEL_CANDIDATES;
    const currentModelIndex = pool.findIndex(
      (m) => m === currentProviderId || currentProviderId?.includes(m),
    );
    const nextModel = pool[(currentModelIndex + 1) % pool.length];

    if (!nextModel || nextModel === currentProviderId) {
      this.logger.warn('No available providers for rotation');
      return null;
    }

    const allProviders = await this.repository.findAllEnabled().catch(() => []);
    const openrouterProv = allProviders.find((p) => p.baseUrl.includes('openrouter.ai'));
    const openrouterKey =
      openrouterProv?.apiKey ||
      (process.env.AI_API_KEY?.startsWith('sk-or-') ? process.env.AI_API_KEY : '');

    if (!openrouterKey) {
      this.logger.warn('No OpenRouter key available for fallback candidate rotation');
      return null;
    }

    this.logger.log(`Rotating to alternate free model candidate: ${nextModel}`);
    return {
      id: `fallback-${nextModel}`,
      name: `OpenRouter Fallback (${nextModel})`,
      type: 'openai-compatible',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: openrouterKey,
      model: nextModel,
    };
  }

  /**
   * Set cooldown for a provider (seconds from now).
   */
  async setCooldown(id: string, seconds: number): Promise<void> {
    await this.repository.setCooldown(id, seconds);
  }

  /**
   * Create a new provider and optionally set it as active.
   */
  async createProvider(data: {
    name: string;
    type: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    headerPrefix?: string;
    headerTitle?: string;
    active?: boolean;
  }): Promise<Provider> {
    const provider = await this.repository.create(data);

    // If this is set as active, deactivate others
    if (data.active) {
      await this.setActive(provider.id);
    }

    return provider;
  }

  /**
   * Update a provider. If api_key is empty string, keep the old one.
   */
  async updateProvider(
    id: string,
    data: {
      name?: string;
      type?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      headerPrefix?: string;
      headerTitle?: string;
    },
  ): Promise<Provider> {
    // If apiKey is empty, don't update it (keep existing)
    if (data.apiKey === '') {
      delete data.apiKey;
    }

    return this.repository.update(id, data);
  }

  /**
   * Get all providers with their status for pool monitoring.
   */
  async findAllForPool(): Promise<Provider[]> {
    return this.repository.findAllForPool();
  }
}
