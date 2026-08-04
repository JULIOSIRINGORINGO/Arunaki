# Dev Log — Preemptive Compaction & Aggregate Tool-Result Budget

**Date & Time:** 2026-08-04 14:58 WIB
**Author:** opencode (big-pickle)

## What

Adopted 2 more OpenClaw patterns for the pre-prompt context guard:

1. **Preemptive compaction (#3)** — estimate prompt pressure BEFORE sending to the provider. If estimated tokens exceed `contextWindow − max_tokens` reserve, run compression first so an over-budget prompt is never sent (small-context models like `deepseek-v4-flash` at 32K reject them with a 400).
2. **Aggregate tool-result budget (#4)** — cap the TOTAL of all tool-result chars at 50% of the context window (`AGGREGATE_TOOL_RESULT_CONTEXT_SHARE = 0.5`), truncating the OLDEST results first while keeping the last 3 intact. Previously we only capped per-result (16K via `truncateResult`).

## Files Changed

- `apps/api/src/modules/ai/context-manager.ts`
  - Added constants: `ESTIMATED_CHARS_PER_TOKEN=4`, `TOOL_RESULT_CHARS_PER_TOKEN=2`, `JSON_PAYLOAD_CHARS_PER_TOKEN=3`, `MESSAGE_BOUNDARY_OVERHEAD_TOKENS=12`, `AGGREGATE_TOOL_RESULT_CONTEXT_SHARE=0.5` (from OpenClaw `preemptive-compaction.ts` / `tool-result-limits.ts`).
  - `estimatePromptTokens()` — overhead + role-weighted estimator (tool results at 2 chars/token).
  - `enforceAggregateToolResultBudget()` — oldest-first truncation, keeps last 3.
  - `compress(messages, contextLength?)` — optional real model context override (was hardcoded 128K), passed through to `protectTailAndSummarize()`.
- `apps/api/src/modules/ai/ai.service.ts`
  - Imported `getModelCapability`.
  - `preemptivelyCompact()` private method; wired into both `chat()` and `chatStream()` before building the request body.
- `apps/api/src/modules/ai/context-manager.spec.ts` — NEW, 4 tests.

## Tests

- `npx vitest run src/modules/ai/context-manager.spec.ts` — ✅ 4/4 passed
- `npx vitest run src/modules/ai src/modules/provider src/modules/tools` — ✅ 44/44 passed
- `npx vitest run` — ✅ 84/84 passed
- `npx nest build` — ✅ 0 errors

## Notes

- Skipped OpenClaw CJK-aware token estimation (#1) — corpus is mostly Latin/Indonesian, low value.
- Skipped cache-TTL two-stage pruning (#2) — we already have a 4-phase pipeline; TTL adds little for the session lengths seen.
- `ponytail:` comment left at `AGGREGATE_TOOL_RESULT_CONTEXT_SHARE` noting the single-threshold approach; upgrade path is OpenClaw's soft-trim/hard-clear two-stage ratios if 32K models still overflow on long sessions.
