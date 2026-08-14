export interface ModelCapability {
  supportsTools: boolean;
  supportsTemperature?: boolean;
  supportsSystemPrompt?: boolean;
  maxTokens?: number;
  contextWindow?: number;
  /**
   * Reasoning models (DeepSeek V4, etc.) emit long `reasoning_content`
   * before any content/tool_calls. If set, the request sends
   * `reasoning_effort` to bound how long the model "thinks", and
   * scaleMaxTokens returns a headroom so thinking never starves the
   * actual response. Without this, a 32000-token context yields
   * max_tokens=1024 and a reasoning model exhausts it on thinking →
   * finish_reason "length", content:null, tool_calls:0 → Arunaki's
   * generic "Sorry, I am unable to provide an answer right now" fallback.
   */
  reasoningEffort?: 'low' | 'medium' | 'high';
}

// Registered ONCE by bare model name — works across all providers
// (OpenRouter `openai/gpt-oss-120b:free`, Groq `gpt-oss-120b`, Kenari `gpt-oss-120b`, etc.)
const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // OpenAI GPT-OSS
  'gpt-oss-20b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'gpt-oss-120b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },

  // Google Gemma 4 — confirmed support tools
  'gemma-4-31b-it': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'gemma-4-26b-a4b-it': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // NVIDIA Nemotron — some support tools
  'nemotron-3-super-120b-a12b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'nemotron-3-nano-30b-a3b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'nemotron-nano-9b-v2': { supportsTools: false, supportsTemperature: false, contextWindow: 32000 },
  'nemotron-nano-12b-v2-vl': { supportsTools: false, supportsTemperature: false, contextWindow: 32000 },
  'nemotron-3.5-content-safety': { supportsTools: false, supportsTemperature: false, contextWindow: 32000 },

  // Cohere
  'north-mini-code': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // Poolside
  'laguna-m.1': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'laguna-xs-2.1': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // Qwen
  'qwen3-coder': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // DeepSeek (Kenari)
  'deepseek-v4-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 32000, reasoningEffort: 'medium' },

  // OpenRouter auto-router pseudonyms — keep full name to avoid collision with `free`/`auto`
  'openrouter/free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'openrouter/auto': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
};

/**
 * Normalize a provider-specific model slug to its bare name:
 * - strips vendor prefix:  `openai/gpt-oss-120b:free` → `gpt-oss-120b`
 * - strips tier suffix:    `:free`, `:extended`, `:paid`, `:nitro`
 * So one registry entry covers the same model across every provider.
 */
export function normalizeModelName(modelName: string): string {
  const withoutSuffix = modelName.replace(/:(free|extended|paid|nitro)$/i, '');
  const slashIdx = withoutSuffix.indexOf('/');
  return slashIdx > 0 ? withoutSuffix.slice(slashIdx + 1) : withoutSuffix;
}

function lookupCapability(modelName: string): ModelCapability | undefined {
  return (
    MODEL_CAPABILITIES[modelName] ??
    MODEL_CAPABILITIES[normalizeModelName(modelName)] ??
    undefined
  );
}

/**
 * Check if a given model supports tool/function calling.
 * Defaults to true for unknown models (assume modern models support tools).
 */
export function modelSupportsTools(modelName: string): boolean {
  return lookupCapability(modelName)?.supportsTools ?? true;
}

/**
 * Get capability for a model, or sensible defaults.
 */
export function getModelCapability(modelName: string): ModelCapability {
  return lookupCapability(modelName) ?? {
    supportsTools: true,
    supportsTemperature: true,
    supportsSystemPrompt: true,
    contextWindow: 32000,
  };
}

/**
 * Scale max_tokens based on context window.
 * Small context (≤32K) → 1024, Medium (≤128K) → 2048, Large (>128K) → 4096.
 * Reasoning models need headroom for thinking even on a small context
 * window, otherwise finish_reason "length" truncates before any
 * content/tool_calls is emitted.
 */
export function scaleMaxTokens(modelName: string): number {
  const cap = getModelCapability(modelName);
  if (cap.reasoningEffort) return 8192;
  if (cap.maxTokens) return cap.maxTokens;
  const ctx = cap.contextWindow ?? 128000;
  if (ctx <= 16000) return 2048;
  return 4096;
}
