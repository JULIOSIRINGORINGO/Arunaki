export interface ModelCapability {
  supportsTools: boolean;
  supportsTemperature?: boolean;
  supportsSystemPrompt?: boolean;
  maxTokens?: number;
  contextWindow?: number;
}

const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // OpenRouter auto-router — delegates to compatible model
  'openrouter/free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'openrouter/auto': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // Google Gemma 4 — confirmed support tools
  'google/gemma-4-31b-it:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'google/gemma-4-26b-a4b-it:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // NVIDIA Nemotron — some support tools
  'nvidia/nemotron-3-super-120b-a12b:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'nvidia/nemotron-3-nano-30b-a3b:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'nvidia/nemotron-nano-9b-v2:free': { supportsTools: false, supportsTemperature: false, contextWindow: 32000 },
  'nvidia/nemotron-nano-12b-v2-vl:free': { supportsTools: false, supportsTemperature: false, contextWindow: 32000 },
  'nvidia/nemotron-3.5-content-safety:free': { supportsTools: false, supportsTemperature: false, contextWindow: 32000 },

  // OpenAI GPT-OSS
  'openai/gpt-oss-20b:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'openai/gpt-oss-120b:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // Cohere
  'cohere/north-mini-code:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // Poolside
  'poolside/laguna-m.1:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'poolside/laguna-xs-2.1:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // Qwen
  'qwen/qwen3-coder:free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // DeepSeek (Kenari)
  'deepseek-v4-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 32000 },
};

/**
 * Check if a given model supports tool/function calling.
 * Defaults to true for unknown models (assume modern models support tools).
 */
export function modelSupportsTools(modelName: string): boolean {
  const cap = MODEL_CAPABILITIES[modelName];
  return cap?.supportsTools ?? true;
}

/**
 * Get capability for a model, or sensible defaults.
 */
export function getModelCapability(modelName: string): ModelCapability {
  return MODEL_CAPABILITIES[modelName] ?? {
    supportsTools: true,
    supportsTemperature: true,
    supportsSystemPrompt: true,
    contextWindow: 32000,
  };
}

/**
 * Scale max_tokens based on context window.
 * Small context (≤32K) → 1024, Medium (≤128K) → 2048, Large (>128K) → 4096.
 */
export function scaleMaxTokens(modelName: string): number {
  const cap = getModelCapability(modelName);
  const ctx = cap.contextWindow ?? 32000;
  if (ctx <= 32000) return 1024;
  if (ctx <= 128000) return 2048;
  return 4096;
}