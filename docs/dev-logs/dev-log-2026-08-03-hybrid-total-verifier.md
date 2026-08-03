# Dev Log — Hybrid Total Verifier (LLM locates, Framework computes)

**Date & Time:** 2026-08-03
**Author:** OpenCode Agent
**Commit:** `6c5f4f4`

## What
Replaced the LLM-extracts-numbers verifier with a hybrid: LLM locates document structure (total anchors + item blocks + filters), framework parses raw amounts itself and recomputes. Numbers never come from the LLM.

## Why (root cause found in live QA)
Previous verifier asked the LLM for `itemValues`. In a live test, the agent appended `CK ANDI = 500RB` to PEMASUKAN but did NOT update `TOTAL PEMASUKAN` (still 3.849 RB) — and the verifier PASSED because the LLM extracted itemValues that conveniently matched the stale total. **LLM cannot be trusted to produce the very numbers being verified.**

## Fix
- `apps/api/src/modules/tools/services/workspace-tools.service.ts`:
  - `recalculateAndVerify` → LLM outputs only structure:
    `{ checks: [{ totalAnchor, itemsFrom, itemsTo, filter? }] }` — locations, never numbers.
  - Added `parseAmount()` — deterministic Indonesian number parser:
    - `1.585RB` → 1585000 (RB = ribu, dot = thousands)
    - `Rp 2.349.000,-` → 2349000
    - `319 RB` → 319000
  - Framework sums amounts inside each item block (optional bank filter) and compares to the total line parsed from the file.
- `apps/api/src/modules/provider/provider-catalog.service.ts` — removed dead free model `qwen/qwen-2.5-coder-32b-instruct:free` (HTTP 404).

## Design (general, not money-specific)
- LLM: locate structure — works for any template / any summary line (totals, per-bank, balances, percentages).
- Framework: parse + compute — deterministic, cannot be biased by the LLM.
- Stale/miscalculated total → caught → `TOTAL_MISMATCH` error → agent retries. Never shipped silently.

## Tests
- `npx tsc --noEmit` (apps/api) — ✅ clean
- `npx vitest run` — ✅ 61/61 pass
- `npm run build` (apps/api) — ✅

## Blocked
- Live E2E QA could not complete: OpenRouter free-model daily quota exhausted (`429: free-models-per-day. Add 10 credits`). Provider cooldowns were cleared and dead model removed, but the account-level quota must reset (or a paid key added) before live rerun.

## Notes
- Prior live run (before quota block) confirmed verifier DOES catch mismatches — it flagged `TOTAL = 4.950 RB != sum(all items)` in the naive-grouping version, which led to this fix.
- Follow-up: agent sometimes updates entries without updating the section total; verifier now catches it. If it recurs often, add a prompt instruction to edit tool: "if you add/change items, also update the section's total in the same edit call."
