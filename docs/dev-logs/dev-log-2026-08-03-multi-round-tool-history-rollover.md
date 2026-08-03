# Dev Log — Multi-Round Tool History Fix + ROLLOVER Success

**Date & Time:** 2026-08-03
**Author:** OpenCode Agent
**Commits:** `7f3f0ac`, `912169e`

## What
Fixed the last blocker for live agent QA: **system messages inserted mid-tool-round** caused OpenAI/DeepSeek `400 upstream_rejected` in round 2+. After fix, temporal rollover completed successfully end-to-end.

## Root cause
OpenAI/DeepSeek reject a `role: system` message placed between `assistant(tool_calls)` and `tool` result rounds. Two places in the runner did exactly that:
1. `prepareNextTurn` (context refresh every 5 rounds) pushed `role: 'system'`.
2. `compactHistory` (LLM compaction + fallback summary) built the summary as `role: 'system'`.

Both landed mid-history once tool rounds existed → 400 in later rounds.

## Fix
- `workspace-runner.service.ts` — `prepareNextTurn` inserts `role: 'user'` (context-refreshed note).
- `compaction.service.ts` — both `compactWithLLM` and `compactWithSummary` produce `role: 'user'` summary.
- `provider.service.ts` — 503 now **retry** (transient), not rotate (was burning a working provider under load).

## Verification (live QA, Kenari `deepseek-v4-flash`)
Before fix: 400 `upstream_rejected` at round 2 (`msgs=[system:17340, ...assistant:0+tc, tool:539]`).
After fix — **ROLLOVER SUCCESS**:
```
ROLLOVER: {"newDate":true, "oldGone":true, "newData":true, "oldData":false}
```
- Header 15 APRIL 2025 → 16 APRIL 2025
- New transactions (CK FAUZAN, CK FADLAN) added
- Old daily data (CK ECA etc.) cleared
- read_workspace_file verify confirmed file content

## Provider model selection (Kenari)
Tested multi-round tool history per model:
- `gpt-oss-120b`: **400 on round 2** (single-round tool calling only) → rejected
- `deepseek-v4-flash`: 200 round-2, multi-round capable, cheap → **selected**
- `gemini-2-5-flash`: 200 round-2, but expensive

Kenari model pinned to `deepseek-v4-flash` (in DB, dev.db, not committed).

## Tests
- `npx vitest run` — ✅ 66/66
- `npx tsc --noEmit` — ✅ clean
- `npm run build` — ✅

## Remaining
- Kenari occasionally returns 400 `upstream_rejected` on valid multi-round requests (host/model intermittency) — one QA run failed at round 2 despite valid message format; another passed fully. Non-deterministic upstream.
- `calculate` tool hallucination: model sometimes calls a tool not in the sent subset (self-healing skips; not fatal).
- Groq (429 daily TPD) + OpenRouter (429 free daily) still exhaust the fallback chain; Kenari is the working path.
