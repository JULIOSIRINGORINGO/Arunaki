import { Injectable, Logger } from '@nestjs/common';

export interface ProviderCatalogPreset {
  id: string;
  name: string;
  baseUrl: string;
  keyPrefix?: string;
  urlKeyword?: string;
  fallbackModels: string[];
}

@Injectable()
export class ProviderCatalogService {
  private readonly logger = new Logger(ProviderCatalogService.name);

  private static readonly PRESETS: ProviderCatalogPreset[] = [
    {
      id: 'groq',
      name: 'Groq LPU',
      baseUrl: 'https://api.groq.com/openai/v1',
      keyPrefix: 'gsk_',
      urlKeyword: 'groq.com',
      fallbackModels: ['llama-3.3-70b-versatile', 'llama3-70b-8192'],
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      keyPrefix: 'sk-or-',
      urlKeyword: 'openrouter.ai',
      fallbackModels: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'openrouter/free',
        'openrouter/auto',
      ],
    },
    {
      id: 'ollama',
      name: 'Ollama Local',
      baseUrl: 'http://localhost:11434/v1',
      urlKeyword: 'localhost:11434',
      fallbackModels: ['llama3', 'qwen2.5-coder', 'mistral'],
    },
    {
      id: 'together',
      name: 'Together AI',
      baseUrl: 'https://api.together.xyz/v1',
      urlKeyword: 'together.xyz',
      fallbackModels: [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        'Qwen/Qwen2.5-Coder-32B-Instruct',
      ],
    },
    {
      id: 'kenari',
      name: 'Kenari',
      baseUrl: 'https://kenari.id/v1',
      keyPrefix: 'kn-',
      urlKeyword: 'kenari.id',
      // Free-tier only rotation pool: Kenari bills per-request even for
      // models labeled free once balance reserves apply, so NEVER put paid
      // models here — rotation must never silently spend user credit.
      fallbackModels: [
        'agnes-2-0-flash:free',
        'glm-4-7-flash:free',
        'step-3-7-flash:free',
        'deepseek-v4-flash:free',
      ],
    },
  ];

  detectPreset(
    apiKey: string = '',
    baseUrl: string = '',
  ): ProviderCatalogPreset {
    const matched = ProviderCatalogService.PRESETS.find(
      (p) =>
        (p.keyPrefix && apiKey.startsWith(p.keyPrefix)) ||
        (p.urlKeyword && baseUrl.includes(p.urlKeyword)),
    );

    return (
      matched ||
      ProviderCatalogService.PRESETS.find((p) => p.id === 'kenari') ||
      ProviderCatalogService.PRESETS[1]
    ); // Default to Kenari
  }

  getNextModelInPreset(
    preset: ProviderCatalogPreset,
    currentModelId?: string,
    triedProviderIds: string[] = [],
  ): string | null {
    const pool = preset.fallbackModels;
    if (!pool || pool.length === 0) return 'default';

    // Prefer the first pool entry NOT yet tried in this rotation. This keeps
    // failover advancing through sibling free models (agnes → glm → step …)
    // instead of re-proposing pool[0], which the caller then discards as
    // already-tried and aborts the whole rotation.
    const untried = pool.find(
      (m) =>
        !triedProviderIds.some(
          (t) => t === m || t.includes(m) || m.includes(t),
        ),
    );
    if (untried) return untried;

    const currentIndex = pool.findIndex(
      (m) => m === currentModelId || currentModelId?.includes(m),
    );

    // Current model unknown → offer the first pool entry.
    // Known → advance, but never wrap around: a full cycle means every
    // candidate already failed and retrying them just re-hits dead models.
    if (currentIndex < 0) return pool[0];
    return currentIndex + 1 < pool.length ? pool[currentIndex + 1] : null;
  }
}
