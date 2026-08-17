export interface ModelCapability {
  supportsTools: boolean;
  supportsTemperature?: boolean;
  supportsSystemPrompt?: boolean;
  maxTokens?: number;
  contextWindow?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  // Some OpenAI-compatible backends (Kenari/vLLM serving gpt-oss) reject or
  // hang when the request history contains `tool_calls`/`tool` role messages
  // (20b → HTTP 400 upstream_rejected, 120b → HTTP 524 origin timeout).
  // They can still *generate* tool calls, just not *receive* them in history;
  // for these models the harness serializes past tool activity into plain text.
  supportsToolCallHistory?: boolean;
}

// Pre-configured baseline capabilities for well-known models across all providers
const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // OpenAI & GPT-OSS
  'gpt-4o': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'gpt-4o-mini': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  // gpt-oss (open-weights, served via OpenAI-compatible endpoints like Kenari/vLLM).
  // NOTE: no `reasoning_effort` here — Kenari serves gpt-oss as a standard tool-calling
  // model; sending reasoning_effort made tool definitions get dropped (see dev-log
  // 2026-08-14). Speed is handled by the [REASONING EFFORT: LOW] prompt directive instead.
  'gpt-oss-20b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 8192, supportsToolCallHistory: false },
  'gpt-oss-120b': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 8192, supportsToolCallHistory: false },

  // Google Gemini & Gemma
  'gemini-2-5-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 1000000, maxTokens: 8192 },
  'gemini-2-5-pro': { supportsTools: true, supportsTemperature: true, contextWindow: 1000000, maxTokens: 8192 },
  'gemini-3-1-flash-lite': { supportsTools: true, supportsTemperature: true, contextWindow: 1000000, maxTokens: 8192 },
  'gemma-4-31b-it': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },
  'gemma-4-26b-a4b-it': { supportsTools: true, supportsTemperature: true, contextWindow: 128000 },

  // DeepSeek
  'deepseek-chat': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'deepseek-coder': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 4096 },
  'deepseek-v4-flash': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 8192 },
  'deepseek-v4-pro': { supportsTools: true, supportsTemperature: true, contextWindow: 128000, maxTokens: 8192 },
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
  // Thinking-capable Claude models — extended thinking with a bounded budget.
  'claude-3-7-sonnet': { supportsTools: true, supportsTemperature: false, contextWindow: 200000, maxTokens: 8192, reasoningEffort: 'low' },
  'claude-sonnet-4': { supportsTools: true, supportsTemperature: false, contextWindow: 200000, maxTokens: 8192, reasoningEffort: 'low' },
  'claude-4-sonnet': { supportsTools: true, supportsTemperature: false, contextWindow: 200000, maxTokens: 8192, reasoningEffort: 'low' },

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
 * Check if a model accepts `tool_calls`/`tool` role messages in its input
 * history. Default true; false for backends that reject/hang on them (gpt-oss
 * on Kenari/vLLM). Such models still generate tool calls — callers must just
 * serialize past tool activity into text when building history.
 */
export function modelSupportsToolCallHistory(modelName: string): boolean {
  const cap = lookupCapability(modelName);
  if (cap && typeof cap.supportsToolCallHistory === 'boolean') {
    return cap.supportsToolCallHistory;
  }
  return true;
}

/**
 * Dynamic, mature capability resolver for any model from any provider.
 * Uses pattern heuristics for unknown models so new models work immediately without code changes.
 */
export function getModelCapability(modelName: string): ModelCapability {
  const cap = lookupCapability(modelName);
  if (cap) return cap;

  const lower = (modelName || '').toLowerCase();
  
  // Dynamic reasoning detection (o1, o3, deepseek-r1, qwq, reasoner, thinking).
  // gpt-oss is intentionally NOT listed: Kenari serves it as a standard tool-calling
  // model and sending reasoning_effort drops tool definitions (dev-log 2026-08-14).
  const isReasoning =
    lower.includes('reasoner') ||
    lower.includes('reasoning') ||
    lower.includes('-r1') ||
    lower.includes('deepseek-r') ||
    lower.includes('qwq') ||
    lower.includes('o1-') ||
    lower.includes('o3-') ||
    lower.includes('claude-3-7') ||
    lower.includes('claude-4') ||
    lower.includes('claude-sonnet-4') ||
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
