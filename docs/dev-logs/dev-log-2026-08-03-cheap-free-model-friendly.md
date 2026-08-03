# Dev Log — Cheap/Free Model Friendly (400 retry, calculate guard)

**Date & Time:** 2026-08-03
**Author:** OpenCode Agent
**Commits:** `2b9b2ce`, `b72e346`

## What
Made the system genuinely cheap/free-model friendly — the product's selling point.

## Principle
Cheap/free providers (Kenari/deepseek, free tiers) are **flaky**: they intermittently return 400 `upstream_rejected` / 503 on valid requests under load, and their models are imprecise with optional tool arguments. The system must tolerate both.

## Changes
1. **`provider.service.ts`** — `classifyError`:
   - `400` now **retries** 3x with backoff before rotating (was: instant rotate + cooldown, which made flaky providers unusable).
   - `503` already retries (transient).
   - Only genuine auth/rate/not-found (`429/413/402/401/403/404`) rotate.
   - Verified live: `HTTP 400 → action: retry` (was `rotate`).
2. **`enterprise-calculator.tool.ts`** — guard `qty`/`price`/`name`:
   - LLM sometimes sends items without qty/price → `item.qty * item.price` threw `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`.
   - Default `qty=0`, `price=0`, `name='Item'`. Tools must be defensive against imprecise cheap models.

## Verification (live QA, Kenari `deepseek-v4-flash`)
Rollover completed successfully:
- `read_workspace_file` verify shows `*REKAPAN PENJUALAN 16 APRIL 2025*` with new transactions `CK FAUZAN = 1.315RB(BCA) [ 37PCS ]`, `CK FADLAN = 974RB(BNI) [ 14 PCS ]`
- Old daily data cleared, cumulative (NOTE BELUM BAYAR) preserved, format intact
- `edit_workspace_file` succeeded after retry
- Occasional `edit_workspace_file` "LLM tidak menghasilkan edit valid" → self-healing retries

## Tests
- `npx vitest run` — ✅ 67/67 (new: 400→retry test)
- `npx tsc --noEmit` — ✅ clean
- `npm run build` — ✅

## Notes
- Kenari model pinned to `deepseek-v4-flash` (DB, dev.db, not committed).
- Groq (429 daily TPD) + OpenRouter (429 free daily) exhaust fallback chain; Kenari is the working path.
- Remaining: `edit_workspace_file` intermittently returns "no valid edits" on first try — self-healing recovers; could improve generateEdits prompt to be more robust.
