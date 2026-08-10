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
      fallbackModels: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
      ],
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
      fallbackModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-Coder-32B-Instruct'],
    },
    {
      id: 'kenari',
      name: 'Kenari',
      baseUrl: 'https://kenari.id/v1',
      keyPrefix: 'kn-',
      urlKeyword: 'kenari.id',
      fallbackModels: ['gpt-oss-120b', 'deepseek-v4-flash'],
    },
  ];

  detectPreset(apiKey: string = '', baseUrl: string = ''): ProviderCatalogPreset {
    const matched = ProviderCatalogService.PRESETS.find(
      (p) =>
        (p.keyPrefix && apiKey.startsWith(p.keyPrefix)) ||
        (p.urlKeyword && baseUrl.includes(p.urlKeyword)),
    );

    return matched || ProviderCatalogService.PRESETS.find(p => p.id === 'kenari') || ProviderCatalogService.PRESETS[1]; // Default to Kenari
  }

  getNextModelInPreset(preset: ProviderCatalogPreset, currentModelId?: string): string {
    const pool = preset.fallbackModels;
    if (!pool || pool.length === 0) return 'default';

    const currentIndex = pool.findIndex(
      (m) => m === currentModelId || currentModelId?.includes(m),
    );

    return pool[(currentIndex + 1) % pool.length];
  }
}
