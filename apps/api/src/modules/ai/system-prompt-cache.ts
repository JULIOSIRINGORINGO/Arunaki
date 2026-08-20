/**
 * System prompt cache-boundary helpers (OpenClaw pattern).
 *
 * Keeps a byte-identical stable prefix separate from dynamic per-turn
 * additions so providers can serve cached_tokens on the prefix.
 */
export const SYSTEM_PROMPT_CACHE_BOUNDARY = '\n<!-- CACHE_BOUNDARY -->\n';

export function splitSystemPromptCacheBoundary(
  text: string,
): { stablePrefix: string; dynamicSuffix: string } | undefined {
  const idx = text.indexOf(SYSTEM_PROMPT_CACHE_BOUNDARY);
  if (idx === -1) return undefined;
  return {
    stablePrefix: text.slice(0, idx).trimEnd(),
    dynamicSuffix: text
      .slice(idx + SYSTEM_PROMPT_CACHE_BOUNDARY.length)
      .trimStart(),
  };
}

/**
 * Prepend dynamic per-turn content AFTER the cache boundary so the stable
 * prefix stays byte-identical across requests. If no boundary exists yet,
 * add one before the dynamic content.
 */
export function prependSystemPromptAdditionAfterCacheBoundary(params: {
  systemPrompt: string;
  systemPromptAddition?: string;
}): string {
  const addition = params.systemPromptAddition?.trim();
  if (!addition) return params.systemPrompt;
  const split = splitSystemPromptCacheBoundary(params.systemPrompt);
  if (!split) {
    return `${params.systemPrompt}${SYSTEM_PROMPT_CACHE_BOUNDARY}${addition}`;
  }
  const dynamicSuffix = split.dynamicSuffix;
  return dynamicSuffix
    ? `${split.stablePrefix}${SYSTEM_PROMPT_CACHE_BOUNDARY}${addition}\n\n${dynamicSuffix}`
    : `${split.stablePrefix}${SYSTEM_PROMPT_CACHE_BOUNDARY}${addition}`;
}

/**
 * In-memory LRU cache for byte-identical stable prefixes (OpenClaw:
 * stablePromptPrefixCache, max 64). Same hash → same cached prefix.
 */
const STABLE_PREFIX_CACHE_LIMIT = 64;
const stablePrefixCache = new Map<string, string>();

export function cacheStablePromptPrefix(
  key: string,
  build: () => string,
): string {
  const cached = stablePrefixCache.get(key);
  if (cached !== undefined) {
    stablePrefixCache.delete(key);
    stablePrefixCache.set(key, cached);
    return cached;
  }
  const value = build();
  stablePrefixCache.set(key, value);
  while (stablePrefixCache.size > STABLE_PREFIX_CACHE_LIMIT) {
    const oldest = stablePrefixCache.keys().next().value;
    if (oldest !== undefined) stablePrefixCache.delete(oldest);
  }
  return value;
}

export function hashStablePromptInput(value: unknown): string {
  let str = '';
  try {
    str = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    str = String(value);
  }
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
