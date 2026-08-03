# Dev Log — Temporal Document Rollover

**Date & Time:** 2026-08-03
**Author:** OpenCode Agent
**Commit:** `3055b4b`

## What
Added general temporal rollover behavior for period documents (dated recaps/reports/logs). When the user says "make the report for today/new period" and a matching template already exists, the agent now rolls over the existing file instead of creating a new one or naively appending.

## Root Cause
- LLM treated "buat laporan hari ini" as a new-file create → called `generate_export`/`write_workspace_file` even though `rekap.txt` (existing template) was the target.
- No rule told the agent: existing template + new period = update it (rollover), not create.
- `edit_workspace_file` failed on Windows files: LLM returns `\n` but files use `\r\n` → exact oldText match failed.

## Fixes Implemented
1. **`apps/api/src/prompts/rules.md`** — added section 7.3 "Temporal Documents & Rollover (GENERAL RULE)":
   - "make/create report for today/new period" + existing template exists → DO NOT create new file → ROLL OVER: update date header, REPLACE running-period data, KEEP cumulative balances, recompute totals.
   - "tambahkan"/"add" → keep everything, append.
   - Prefer `edit_workspace_file` over `write_workspace_file`/`generate_export` when template exists.
2. **`apps/api/src/modules/tools/tools-provider.module.ts`** — `edit_workspace_file` description now explicit about when to use it (existing template, new-period update, rollover) and says NOT to use write/generate_export in that case. Added `rollover` tag.
3. **`apps/api/src/modules/tools/services/workspace-tools.service.ts`**:
   - `generateEdits` system prompt: distinguish NEW PERIOD (rollover: replace running data, keep cumulative) vs ADD/APPEND vs FIX.
   - `editWorkspaceFile`: CRLF tolerance — try exact oldText match, then CRLF-normalized; replacement preserves the file's newline style.

## Verification (live QA, temp workspace)
- Seed: `rekap.txt` = `REKAPAN TERBARU1.txt` (15 APRIL 2025, with old daily transactions).
- Goal: "Buat laporan hari ini tanggal 16 April 2025 dengan data: CK FAUZAN = 1.315RB(BCA) [ 37PCS ]; CK FADLAN = 974RB(BNI) [ 14 PCS ]".
- Result (file after):
  - `newDatePresent: true` — header → 16 APRIL 2025
  - `oldDateGone: true` — 15 April removed
  - `newDataPresent: true` — CK FAUZAN + CK FADLAN present
  - `oldDailyDataStillThere: false` — old daily transactions (CK ECA etc.) cleared
  - `cumulativeKept: true` — CI LISOI etc. preserved
- Tool path: read → edit (failed once, oldText mismatch on large rollover) → fallback write_workspace_file (success) → read verify.

## Tests
- `npx tsc --noEmit` (apps/api) — ✅ clean
- `npx vitest run` — ✅ 61/61 pass
- `npm run build` (apps/api) — ✅

## Notes
- Design stays GENERAL — no file-specific names in rules; works for any period document shape.
- `edit_workspace_file` still occasionally fails on large rollover edits (LLM generates a too-large oldText). Fallback to `write_workspace_file` produces correct results. Could tighten LLM instruction to split rollover into smaller edits if it recurs.
- Env: live QA needs `ARUNAKI_API_KEY` + `ARUNAKI_VAULT_KEY` in `.env`, and `x-api-key` header on requests (security fix from upstream pull). API + test must run in ONE shell command (background process dies when shell exits).
