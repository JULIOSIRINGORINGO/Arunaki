import { Injectable, Logger, Optional } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { ProviderRepository } from './provider.repository.js';
import { ProviderCatalogService } from './provider-catalog.service.js';
import { SecretsVaultService } from '../security/secrets-vault.service.js';

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

  // Model-level cooldown (in-memory): a hung/slow model is skipped while
  // sibling models on the same provider stay available. Keyed by `providerId::model`.
  private readonly modelCooldowns = new Map<string, number>();

  private readonly catalogService: ProviderCatalogService;

  constructor(
    protected readonly repository: ProviderRepository,
    @Optional() catalogService?: ProviderCatalogService,
    @Optional() private readonly vaultService?: SecretsVaultService,
  ) {
    super(repository);
    this.catalogService = catalogService || new ProviderCatalogService();
    this.vaultService = vaultService || new SecretsVaultService();
  }

  private encryptApiKey(key: string): string {
    if (!key || !this.vaultService) return key;
    try {
      const payload = this.vaultService.encryptSecret(key);
      return JSON.stringify(payload);
    } catch (error: any) {
      this.logger.warn(
        `Failed to encrypt API key, storing as plaintext: ${error.message}`,
      );
      return key;
    }
  }

  public decryptApiKey(key: string): string {
    if (!key || !this.vaultService) return key;
    try {
      const payload = JSON.parse(key);
      if (payload && payload.cipherText && payload.iv) {
        try {
          return this.vaultService.decryptSecret(payload);
        } catch (error: any) {
          this.logger.warn(`Failed to decrypt API key: ${error.message}`);
          return '';
        }
      }
    } catch {
      // Return plaintext for legacy keys
    }
    return key;
  }

  async findActive(): Promise<Provider | null> {
    return this.repository ? this.repository.findActive() : null;
  }

  async findAllEnabled(): Promise<Provider[]> {
    return this.repository ? this.repository.findAllEnabled() : [];
  }

  async getActiveConfig(): Promise<ProviderConfig | null> {
    return this.buildActiveConfig(false);
  }

  /**
   * Active provider config, but null while the provider is cooling down —
   * used by the AI layer so a degraded provider gets skipped and the
   * request starts directly on the fallback provider instead of hanging.
   */
  async getActiveConfigRespectingCooldown(): Promise<ProviderConfig | null> {
    return this.buildActiveConfig(true);
  }

  private async buildActiveConfig(
    respectCooldown: boolean,
  ): Promise<ProviderConfig | null> {
    const provider = this.repository
      ? await this.repository.findActive()
      : null;
    if (!provider) return null;

    if (
      respectCooldown &&
      provider.cooldownUntil &&
      new Date(provider.cooldownUntil) > new Date()
    ) {
      this.logger.warn(
        `Active provider ${provider.name} is in cooldown until ${provider.cooldownUntil.toISOString()} — deferring to fallback provider`,
      );
      return null;
    }

    // Reorder models so the first non-cooled model is primary — a hung/slow
    // model is skipped automatically while sibling models stay usable. If
    // every model is cooled, defer to the fallback provider entirely.
    let model = provider.model;
    if (respectCooldown) {
      const models = (provider.model || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      if (models.length === 0) return null;
      const cooled = models.filter((m) =>
        this.isModelCoolingDown(`${provider.id}::${m}`),
      );
      const eligible = models.filter(
        (m) => !this.isModelCoolingDown(`${provider.id}::${m}`),
      );
      if (eligible.length === 0) {
        this.logger.warn(
          `Active provider ${provider.name} has all models in cooldown — deferring to fallback provider`,
        );
        return null;
      }
      model = [...eligible, ...cooled].join(', ');
    }

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: this.decryptApiKey(provider.apiKey),
      model,
      headerPrefix: provider.headerPrefix || undefined,
      headerTitle: provider.headerTitle || undefined,
    };
  }

  async getById(id: string): Promise<ProviderConfig | null> {
    if (!this.repository) return null;
    const provider = await this.repository.findById(id);
    if (!provider) return null;

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: this.decryptApiKey(provider.apiKey),
      model: provider.model,
      headerPrefix: provider.headerPrefix || undefined,
      headerTitle: provider.headerTitle || undefined,
    };
  }

  async setActive(id: string): Promise<void> {
    await this.repository.setActive(id);
  }

  async recordUsage(id: string): Promise<void> {
    const realId = id.split('::')[0];
    if (
      this.repository &&
      this.repository.recordUsage &&
      !realId.startsWith('fallback-') &&
      !realId.startsWith('env-')
    ) {
      await Promise.resolve(this.repository.recordUsage(realId)).catch(
        () => {},
      );
    }
  }

  async recordError(id: string, errorMessage: string): Promise<void> {
    const realId = id.split('::')[0];
    if (
      this.repository &&
      this.repository.recordError &&
      !realId.startsWith('fallback-') &&
      !realId.startsWith('env-')
    ) {
      await Promise.resolve(
        this.repository.recordError(realId, errorMessage),
      ).catch(() => {});
    }
  }

  async setCooldown(id: string, seconds: number): Promise<void> {
    const parts = id.split('::');
    if (
      parts.length > 1 &&
      !parts[0].startsWith('fallback-') &&
      !parts[0].startsWith('env-')
    ) {
      // Model-level cooldown: cool only this model, keep sibling models usable.
      const key = `${parts[0]}::${parts[1]}`;
      this.modelCooldowns.set(key, Date.now() + seconds * 1000);
      return;
    }
    const realId = id.split('::')[0];
    if (
      this.repository &&
      this.repository.setCooldown &&
      !realId.startsWith('fallback-') &&
      !realId.startsWith('env-')
    ) {
      await Promise.resolve(this.repository.setCooldown(realId, seconds)).catch(
        () => {},
      );
    }
  }

  classifyError(statusCode: number, body: string): ClassifiedError {
    const message = `HTTP ${statusCode}`;

    if (statusCode >= 522 && statusCode <= 524) {
      return {
        action: 'rotate',
        statusCode,
        message: `${message}: origin timeout`,
        cooldownSeconds: 60,
      };
    }

    if ((statusCode >= 500 && statusCode < 600) || statusCode === 400) {
      if (
        statusCode === 400 &&
        (body.includes('model_decommissioned') ||
          body.includes('model_not_found') ||
          body.includes('invalid_api_key'))
      ) {
        return {
          action: 'rotate',
          statusCode,
          message: `${message}: ${body.substring(0, 150)}`,
          cooldownSeconds: 300,
        };
      }
      return {
        action: 'retry',
        statusCode,
        message,
      };
    }

    if ([429, 413, 402, 401, 403, 404].includes(statusCode)) {
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

  async getNextAvailable(
    currentProviderId?: string,
    triedProviderIds: string[] = [],
  ): Promise<ProviderConfig | null> {
    // 1. Check database providers not in cooldown
    let available: Provider[] = [];
    if (this.repository) {
      if (typeof this.repository.findAvailable === 'function') {
        available = await Promise.resolve(
          this.repository.findAvailable(),
        ).catch(() => []);
      } else if (typeof this.repository.findAllEnabled === 'function') {
        available = await Promise.resolve(
          this.repository.findAllEnabled(),
        ).catch(() => []);
      }
    }
    if (!Array.isArray(available)) {
      available = available ? [available] : [];
    }

    for (const p of available) {
      const models = (p.model || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      for (let i = 0; i < models.length; i++) {
        const m = models[i];
        const candidateId = models.length > 1 ? `${p.id}::${m}` : p.id;

        const isTried =
          triedProviderIds.includes(candidateId) ||
          triedProviderIds.includes(p.id) ||
          (currentProviderId &&
            (currentProviderId === candidateId ||
              (i === 0 &&
                (currentProviderId === p.id ||
                  currentProviderId.startsWith(p.id + '::')))));

        if (!isTried) {
          const modelKey = models.length > 1 ? `${p.id}::${m}` : p.id;
          if (this.isModelCoolingDown(modelKey)) {
            this.logger.log(
              `Skipping provider pool candidate [${p.name}] model: ${m} (model cooldown)`,
            );
            continue;
          }
          this.logger.log(
            `Rotating to provider pool candidate [${p.name}] model: ${m}`,
          );
          return {
            id: candidateId,
            name: models.length > 1 ? `${p.name} (${m})` : p.name,
            type: p.type,
            baseUrl: p.baseUrl,
            apiKey: this.decryptApiKey(p.apiKey),
            model: m,
            headerPrefix: p.headerPrefix || undefined,
            headerTitle: p.headerTitle || undefined,
          };
        }
      }
    }

    // 2. Check enabled database providers for registered fallback credentials
    const allProviders = this.repository
      ? await this.repository.findAvailable().catch(() => [])
      : [];
    const openrouterProv = allProviders.find((p) =>
      p.baseUrl.includes('openrouter.ai'),
    );

    if (openrouterProv) {
      const preset = this.catalogService.detectPreset(
        openrouterProv.apiKey,
        openrouterProv.baseUrl,
      );
      const nextModel = this.catalogService.getNextModelInPreset(
        preset,
        currentProviderId,
      );

      this.logger.log(
        `Rotating to OpenRouter database candidate: ${nextModel}`,
      );
      return {
        id: `fallback-${nextModel}`,
        name: `OpenRouter Fallback (${nextModel})`,
        type: 'openai-compatible',
        baseUrl: openrouterProv.baseUrl,
        apiKey: this.decryptApiKey(openrouterProv.apiKey),
        model: nextModel,
      };
    }

    // 3. Fallback to process.env credential rotation using ProviderCatalogService
    const envKey = process.env.AI_API_KEY || '';
    const envBaseUrl = process.env.AI_BASE_URL || '';

    if (envKey) {
      const preset = this.catalogService.detectPreset(envKey, envBaseUrl);
      const nextModel = this.catalogService.getNextModelInPreset(
        preset,
        currentProviderId,
      );
      const targetId = `fallback-${preset.id}-${nextModel}`;

      if (triedProviderIds.includes(targetId)) {
        this.logger.log(`No more un-tried models in preset ${preset.name}`);
        return null;
      }

      this.logger.log(
        `Rotating ${preset.name} fallback candidate to: ${nextModel}`,
      );
      return {
        id: targetId,
        name: `${preset.name} Fallback (${nextModel})`,
        type: 'openai-compatible',
        baseUrl: preset.baseUrl,
        apiKey: envKey,
        model: nextModel,
      };
    }

    this.logger.warn(
      'No secondary API key available for fallback candidate rotation',
    );
    return null;
  }

  /**
   * Check if the active provider is currently in cooldown.
   * Used by the AI layer to skip a degraded provider and start on the
   * fallback provider instead of wasting another timeout window.
   */
  async isActiveProviderCoolingDown(): Promise<boolean> {
    const provider = this.repository
      ? await this.repository.findActive()
      : null;
    if (!provider) return false;
    return (
      !!provider.cooldownUntil && new Date(provider.cooldownUntil) > new Date()
    );
  }

  isModelCoolingDown(modelKey: string): boolean {
    if (!this.modelCooldowns.has(modelKey)) return false;
    if ((this.modelCooldowns.get(modelKey) ?? 0) > Date.now()) return true;
    this.modelCooldowns.delete(modelKey);
    return false;
  }

  async createProvider(
    data: Partial<Provider> & {
      name: string;
      baseUrl: string;
      apiKey: string;
      model: string;
    },
  ): Promise<Provider> {
    const provider = await this.repository.create({
      name: data.name,
      type: data.type || 'openai-compatible',
      baseUrl: data.baseUrl,
      apiKey: this.encryptApiKey(data.apiKey),
      model: data.model,
      priority: data.priority ?? 0,
      active: data.active ?? false,
      headerPrefix: data.headerPrefix || null,
      headerTitle: data.headerTitle || null,
    });

    if (data.active) {
      await this.setActive(provider.id);
    }

    return provider;
  }

  async updateProvider(id: string, data: Partial<Provider>): Promise<Provider> {
    if (data.apiKey === '' || (data.apiKey && data.apiKey.includes('...'))) {
      delete data.apiKey;
    } else if (data.apiKey) {
      data.apiKey = this.encryptApiKey(data.apiKey);
    }
    return this.repository.update(id, { ...data, cooldownUntil: null });
  }

  async findAllForPool(): Promise<Provider[]> {
    return this.repository.findAllForPool();
  }
}
