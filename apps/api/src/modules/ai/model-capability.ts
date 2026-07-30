export interface ModelCapability {
  supportsTools: boolean;
  supportsTemperature?: boolean;
  supportsSystemPrompt?: boolean;
  maxTokens?: number;
}

const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // OpenRouter auto-router — delegates to compatible model
  'openrouter/free': { supportsTools: true, supportsTemperature: true },
  'openrouter/auto': { supportsTools: true, supportsTemperature: true },

  // Google Gemma 4 — confirmed support tools
  'google/gemma-4-31b-it:free': { supportsTools: true, supportsTemperature: true },
  'google/gemma-4-26b-a4b-it:free': { supportsTools: true, supportsTemperature: true },

  // NVIDIA Nemotron — some support tools
  'nvidia/nemotron-3-super-120b-a12b:free': { supportsTools: true, supportsTemperature: true },
  'nvidia/nemotron-3-nano-30b-a3b:free': { supportsTools: true, supportsTemperature: true },
  'nvidia/nemotron-nano-9b-v2:free': { supportsTools: false, supportsTemperature: false },
  'nvidia/nemotron-nano-12b-v2-vl:free': { supportsTools: false, supportsTemperature: false },
  'nvidia/nemotron-3.5-content-safety:free': { supportsTools: false, supportsTemperature: false },

  // OpenAI GPT-OSS
  'openai/gpt-oss-20b:free': { supportsTools: true, supportsTemperature: true },
  'openai/gpt-oss-120b:free': { supportsTools: true, supportsTemperature: true },

  // Cohere
  'cohere/north-mini-code:free': { supportsTools: true, supportsTemperature: true },

  // Poolside
  'poolside/laguna-m.1:free': { supportsTools: true, supportsTemperature: true },
  'poolside/laguna-xs-2.1:free': { supportsTools: true, supportsTemperature: true },

  // Qwen
  'qwen/qwen3-coder:free': { supportsTools: true, supportsTemperature: true },
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
  };
}