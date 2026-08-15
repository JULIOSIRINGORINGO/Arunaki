export interface ModelCapability {
  supportsTools: boolean;
  supportsTemperature?: boolean;
  supportsSystemPrompt?: boolean;
  maxTokens?: number;
  contextWindow?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

// Pre-configured baseline capabilities for well-known models across all providers
const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // OpenAI & GPT-OSS
  'gpt-4o': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'gpt-4o-mini': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'gpt-oss-20b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'gpt-oss-120b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },

  // Google Gemini & Gemma
  'gemini-2-5-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 1000000, maxTokens: 8192 },
  'gemini-2-5-pro': { supportsTools: true, supportsTemperature: true, contextWindow: 1000000, maxTokens: 8192 },
  'gemini-3-1-flash-lite': { supportsTools: true, supportsTemperature: true, contextWindow: 1000000, maxTokens: 8192 },
  'gemma-4-31b-it': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'gemma-4-26b-a4b-it': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // DeepSeek
  'deepseek-chat': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'deepseek-coder': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'deepseek-v4-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 8192, reasoningEffort: 'low' },
  'deepseek-reasoner': { supportsTools: true, supportsTemperature: false, contextWindow: 128000, maxTokens: 8192, reasoningEffort: 'low' },

  // Qwen
  'qwen-2.5-72b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'qwen-2.5-32b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'qwen-2.5-coder-32b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'qwen3-7-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'qwen3-coder': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // StepFun & others
  'step-3-7-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },

  // Anthropic Claude
  'claude-3-5-sonnet': { supportsTools: true, supportsTemperature: true, contextWindow: 200000, maxTokens: 8192 },
  'claude-3-5-haiku': { supportsTools: true, supportsTemperature: true, contextWindow: 200000, maxTokens: 8192 },

  // OpenRouter auto-router aliases
  'openrouter/free': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'openrouter/auto': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
};

/**
 * Normalize a provider-specific model slug to its bare name:
 * - strips vendor prefix:  `openai/gpt-oss-120b:free` → `gpt-oss-120b`
 * - strips tier suffix:    `:free`, `:extended`, `:paid`, `:nitro`, `:online`
 */
export function normalizeModelName(modelName: string): string {
  if (!modelName) return '';
  const withoutSuffix = modelName.replace(/:(free|extended|paid|nitro|online|exact)$/i, '');
  const slashIdx = withoutSuffix.lastIndexOf('/');
  return slashIdx >= 0 ? withoutSuffix.slice(slashIdx + 1) : withoutSuffix;
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
 * Mature harness default: true for unknown models unless explicitly flagged false.
 */
export function modelSupportsTools(modelName: string): boolean {
  return lookupCapability(modelName)?.supportsTools ?? true;
}

/**
 * Dynamic, mature capability resolver for any model from any provider.
 * Uses pattern heuristics for unknown models so new models work immediately without code changes.
 */
export function getModelCapability(modelName: string): ModelCapability {
  const cap = lookupCapability(modelName);
  if (cap) return cap;

  const lower = (modelName || '').toLowerCase();
  
  // Dynamic reasoning detection (o1, o3, deepseek-r1, qwq, reasoner, thinking)
  const isReasoning =
    lower.includes('reasoner') ||
    lower.includes('reasoning') ||
    lower.includes('-r1') ||
    lower.includes('deepseek-r') ||
    lower.includes('qwq') ||
    lower.includes('o1-') ||
    lower.includes('o3-') ||
    lower.includes('thinking');

  // Dynamic context window estimation
  let contextWindow = 128000;
  if (lower.includes('gemini')) contextWindow = 1000000;
  else if (lower.includes('claude')) contextWindow = 200000;
  else if (lower.includes('16k') || lower.includes('32k')) contextWindow = 32000;

  return {
    supportsTools: true,
    supportsTemperature: !isReasoning,
    supportsSystemPrompt: true,
    contextWindow,
    maxTokens: isReasoning ? 8192 : 4096,
    reasoningEffort: isReasoning ? 'low' : undefined,
  };
}

/**
 * Scale max output tokens based on model capability and context window.
 */
export function scaleMaxTokens(modelName: string): number {
  const cap = getModelCapability(modelName);
  if (cap.reasoningEffort) return 8192;
  if (cap.maxTokens) return cap.maxTokens;
  const ctx = cap.contextWindow ?? 128000;
  if (ctx <= 16000) return 2048;
  return 4096;
}
