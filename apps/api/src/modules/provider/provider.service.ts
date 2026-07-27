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

@Injectable()
export class ProviderService extends BaseService<Provider> {
  private readonly logger = new Logger(ProviderService.name);

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
    const provider = await this.repository.create(data as any);

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

    return this.repository.update(id, data as any);
  }
}
