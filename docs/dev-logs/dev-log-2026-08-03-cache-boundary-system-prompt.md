# Dev Log — OpenClaw Cache-Boundary System Prompt

**Date & Time:** 2026-08-03
**Author:** OpenCode Agent
**Commit:** `25cbd30`

## What
Restructured the system prompt into a byte-identical STABLE prefix + volatile suffix with a `<!-- CACHE_BOUNDARY -->` marker, ported 1:1 from OpenClaw's `system-prompt-cache-boundary.ts` pattern.

## Why (root cause from OpenClaw source)
OpenClaw (`packages/ai/src/utils/system-prompt-cache-boundary.ts` + `src/agents/system-prompt.ts:1381,1385`) keeps a stable prompt prefix byte-identical across requests so providers serve `cached_tokens` on it. The dynamic/temporal/approval content goes BELOW the boundary.

Arunaki was doing the opposite:
- `rules.md` had `{TOOL_LIST}` injected per request (via tool router subset) → the whole prompt changed every request → cache miss every time.
- Temporal + workspace context sat mid-prompt → also volatile.

## Changes
- **New `apps/api/src/modules/ai/system-prompt-cache.ts`** (OpenClaw port):
  - `SYSTEM_PROMPT_CACHE_BOUNDARY = "\n<!-- CACHE_BOUNDARY -->\n"`
  - `splitSystemPromptCacheBoundary()`
  - `prependSystemPromptAdditionAfterCacheBoundary()`
  - `cacheStablePromptPrefix()` — in-memory LRU (hash → reused, max 64)
  - `hashStablePromptInput()`
- **`ai.service.ts`** — both workspace & chat modes:
  - Stable prefix: identity + rules + memory + verification (+ modelAdditions), built once via cache.
  - Volatile suffix: tool list, workspace context / knowledge base, memory section, temporal.
- **`rules.md` / `chat-rules.md`** — removed `{TOOL_LIST}` placeholder (tool list now lives in the volatile suffix).
- **`system-prompt-cache.spec.ts`** — 5 tests: boundary exists, split, prepend keeps prefix, LRU reuse, byte-identical prefix across volatile variants.

## Impact
- Providers can serve `cached_tokens` on the stable prefix → lower cost, smaller effective payload, less risk of context-length rejection (Kenari `upstream_rejected` / Groq 413).
- Combined with the tool router (prior commit), LLM payload is now drastically smaller and prefix-stable.

## Tests
- `npx vitest run` — ✅ 66/66 (5 new)
- `npx tsc --noEmit` — ✅ clean
- `npm run build` — ✅

## Notes
- `context.systemPrompt` (projections) appended by the runner lands AFTER the boundary inside the same system message — does not break the stable prefix.
- Live provider QA still blocked by low Kenari balance (Rp 321) + OpenRouter daily free quota. Re-run when topped up to observe `cached_tokens > 0` in billing.
