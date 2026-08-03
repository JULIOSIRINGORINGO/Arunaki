# Dev Log — Tool Schema Fix, Tool Router, Cache Boundary, Prompt Slim (Kenari 400 root cause)

**Date & Time:** 2026-08-03
**Author:** OpenCode Agent
**Commits:** `96cd1ba`, `c2a9058`, `36474d2`, `25cbd30`, `8e3ca7b`

## What
Resolved the Kenari `400 upstream_rejected` that blocked live agent QA, plus made the system genuinely lighter for the LLM (OpenClaw-style).

## Root cause (Kenari 400) — found by isolation testing
- `write_workspace_file` and `generate_export` tool schemas had `rows: { type: 'array' }` **without `items`**.
- Verified: same request with no-items array = **400**, with-items = **200**. Gemini/Kenari rejects array schemas lacking `items`.
- Also: 10+ tool schemas + large system prompt exceeded Kenari's per-request tool limit (~7-8 tools for a 17KB system).

## Changes
1. **`tools-provider.module.ts`** — added `items: { type: 'object' }` to `rows` in `write_workspace_file` and `generate_export`.
2. **`workspace-runner.service.ts`** — Tool Router:
   - Core = 7 file-op tools (removed `calculate`).
   - `generate_export` only on explicit "export" keyword; `draft_communication` only on comm keyword; dropped the "laporan" → generate_export rule.
   - Keeps tool count under the ~7-8 limit.
3. **`ai.service.ts`** — log request context (model, tools, msg sizes) on 4xx for provider diagnosis; `max_tokens` 4096→1024.
4. **`system-prompt-cache.ts`** + restructured `getSystemPrompt` — OpenClaw cache-boundary pattern: byte-identical stable prefix + volatile suffix (`<!-- CACHE_BOUNDARY -->`), in-memory LRU for the prefix.
5. **`rules.md`** 9.6KB→2.6KB, **`chat-rules.md`** 5.6KB→2.1KB — removed redundant step-by-step examples; stable workspace prefix ~4.6KB (was ~11.7KB).

## Live QA (Kenari, after top-up + cooldown clear)
- Kenari now returns **200** (was 400). Agent runs:
  - `read_workspace_file` → success
  - `edit_workspace_file` → verifier caught `TOTAL = 479000 != sum(958007)` — **hybrid verifier works**
  - `calculate` → error (model called it despite not being in the sent tool subset — tool hallucination; not fatal, self-healing skips)
- Rollover not fully completed: agent stopped after verifier mismatch (did not recompute + rewrite). Verifier did its job (rejected bad totals); the model then gave up rather than fixing.

## Tests
- `npx vitest run` — ✅ 66/66 (5 cache-boundary tests)
- `npx tsc --noEmit` — ✅ clean
- `npm run build` — ✅

## Remaining
- Agent gives up after verifier mismatch instead of re-editing with correct totals. Consider: on `TOTAL_MISMATCH`, inject feedback into the edit-diff LLM call ("totals must match: X != Y, recompute") and retry once.
- `calculate` hallucination: only execute tools that were in the sent subset (guard in runner), or accept self-healing skip.
- Groq 429 (daily TPD) + OpenRouter 429 (free daily) still exhaust fallback chain; Kenari is now the working path.
