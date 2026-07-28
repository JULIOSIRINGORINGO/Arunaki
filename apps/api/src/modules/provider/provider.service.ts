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
    '429': 60, // Rate limit: 1 minute cooldown
    '402': 300, // Payment required: 5 minutes
    '401': 600, // Auth error: 10 minutes
    '403': 600, // Forbidden: 10 minutes
    '500': 30, // Server error: 30 seconds (will retry anyway)
    '502': 30, // Bad gateway: 30 seconds
    '503': 60, // Service unavailable: 1 minute
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
   * 429, 402, 401, 403, 503 → rotate (switch provider, cooldown)
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

    // 429, 402, 401, 403, 503 → rotate to next provider
    if ([429, 402, 401, 403, 503].includes(statusCode)) {
      const cooldownKey = String(statusCode) as keyof typeof this.COOLDOWN;
      return {
        action: 'rotate',
        statusCode,
        message,
        cooldownSeconds: this.COOLDOWN[cooldownKey] || 60,
      };
    }

    // Other errors → fatal
    return {
      action: 'fatal',
      statusCode,
      message: `${message}: ${body.substring(0, 200)}`,
    };
  }

  /**
   * Get next available provider for rotation.
   * Returns the first provider not in cooldown, or null if all are cooling down.
   */
  async getNextAvailable(
    currentProviderId?: string,
  ): Promise<ProviderConfig | null> {
    const available = await this.repository.findAvailable();

    // Skip the current provider (we're rotating AWAY from it)
    const next = available.find((p) => p.id !== currentProviderId);

    if (!next) {
      this.logger.warn('No available providers for rotation (all in cooldown)');
      return null;
    }

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
