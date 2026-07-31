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

export type ErrorAction = 'retry' | 'rotate' | 'fatal';

export interface ClassifiedError {
  action: ErrorAction;
  statusCode: number;
  message: string;
  cooldownSeconds?: number;
}

@Injectable()
export class ProviderService extends BaseService<Provider> {
  private readonly logger = new Logger(ProviderService.name);

  private readonly COOLDOWN = {
    '429': 20,
    '402': 300,
    '401': 300,
    '403': 300,
    '400': 5,
    '500': 10,
    '502': 10,
    '503': 20,
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

  classifyError(statusCode: number, body: string): ClassifiedError {
    const message = `HTTP ${statusCode}`;

    if (statusCode >= 500 && statusCode < 600 && statusCode !== 503) {
      return {
        action: 'retry',
        statusCode,
        message,
      };
    }

    if ([429, 413, 402, 401, 403, 503, 404, 400].includes(statusCode)) {
      const cooldownKey = String(statusCode) as keyof typeof this.COOLDOWN;
      return {
        action: 'rotate',
        statusCode,
        message: `${message}: ${body.substring(0, 150)}`,
        cooldownSeconds: this.COOLDOWN[cooldownKey] || 30,
      };
    }

    return {
      action: 'fatal',
      statusCode,
      message: `${message}: ${body.substring(0, 200)}`,
    };
  }

  private static readonly FREE_MODEL_CANDIDATES = [
    'openrouter/free',
    'openrouter/auto',
  ];

  async getNextAvailable(
    currentProviderId?: string,
  ): Promise<ProviderConfig | null> {
    const available: Provider[] = await this.repository.findAvailable().catch(() => []);

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

    // 1. Check enabled providers in DB for OpenRouter key or alternate provider
    const allProviders = await this.repository.findAllEnabled().catch(() => []);
    const openrouterProv = allProviders.find((p) => p.baseUrl.includes('openrouter.ai'));
    
    if (openrouterProv) {
      const pool = ProviderService.FREE_MODEL_CANDIDATES;
      const currentModelIndex = pool.findIndex(
        (m) => m === currentProviderId || currentProviderId?.includes(m),
      );
      const nextModel = pool[(currentModelIndex + 1) % pool.length];

      this.logger.log(`Rotating to OpenRouter database candidate: ${nextModel}`);
      return {
        id: `fallback-${nextModel}`,
        name: `OpenRouter Fallback (${nextModel})`,
        type: 'openai-compatible',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: openrouterProv.apiKey,
        model: nextModel,
      };
    }

    // 2. Fallback to process.env AI_API_KEY (Groq or OpenRouter)
    const envKey = process.env.AI_API_KEY || '';
    const envBaseUrl = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';

    if (envKey.startsWith('gsk_') || envBaseUrl.includes('groq.com')) {
      const groqPool = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
      const currentModelIndex = groqPool.findIndex((m) => currentProviderId?.includes(m));
      const nextModel = groqPool[(currentModelIndex + 1) % groqPool.length];

      this.logger.log(`Rotating Groq fallback model to: ${nextModel}`);
      return {
        id: `fallback-groq-${nextModel}`,
        name: `Groq Fallback (${nextModel})`,
        type: 'openai-compatible',
        baseUrl: envBaseUrl,
        apiKey: envKey,
        model: nextModel,
      };
    }

    if (envKey.startsWith('sk-or-')) {
      const pool = ProviderService.FREE_MODEL_CANDIDATES;
      const currentModelIndex = pool.findIndex(
        (m) => m === currentProviderId || currentProviderId?.includes(m),
      );
      const nextModel = pool[(currentModelIndex + 1) % pool.length];

      this.logger.log(`Rotating to OpenRouter env candidate: ${nextModel}`);
      return {
        id: `fallback-${nextModel}`,
        name: `OpenRouter Fallback (${nextModel})`,
        type: 'openai-compatible',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: envKey,
        model: nextModel,
      };
    }

    this.logger.warn('No secondary API key available for fallback candidate rotation');
    return null;
  }

  async setCooldown(id: string, seconds: number): Promise<void> {
    await this.repository.setCooldown(id, seconds);
  }

  async createProvider(data: Partial<Provider> & { name: string; baseUrl: string; apiKey: string; model: string }): Promise<Provider> {
    return this.repository.create({
      name: data.name,
      type: data.type || 'openai-compatible',
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      model: data.model,
      priority: data.priority ?? 0,
      active: data.active ?? false,
      headerPrefix: data.headerPrefix || null,
      headerTitle: data.headerTitle || null,
    });
  }
}
