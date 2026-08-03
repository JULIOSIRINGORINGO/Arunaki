# Dev Log — edit_workspace_file Tool (LLM Edit-Diff)

**Date & Time:** 2026-08-03
**Author:** OpenCode Agent
**Commit:** `d37f1e3`

## What
Added `edit_workspace_file` tool that edits existing files via precise LLM edit-diff instead of full rewrite. Solves temporal-document update (naive append bias) by letting the LLM reason over the full document while the framework applies only the changed lines deterministically.

## Why
- Full regenerate wastes tokens (LLM outputs every line) and risks accidental data loss (unchanged lines pass through the model).
- Edit-diff: LLM reads full file (input) but outputs only `[{oldText,newText}]` (small output). Framework applies via exact string match — untouched content is preserved by construction.
- General: no regex/parser assumptions about file structure. LLM decides which lines change and applies rollover reasoning (update date, reset running-period data, keep cumulative balances) for any document shape.

## Files Changed
- `apps/api/src/modules/tools/services/workspace-tools.service.ts`:
  - Injected `@Optional() @Inject(forwardRef(() => AiService))` (ToolsProviderModule already imports AiModule via forwardRef)
  - `editWorkspaceFile(params)` — resolve file (fuzzy name match), read full, call `generateEdits`, apply each edit (exact match; fail loudly if `oldText` not found), verify content changed, write back
  - `generateEdits()` — LLM prompt: output ONLY JSON array of edits, exact-match rule, period-rollover rule, keep formatting
- `apps/api/src/modules/tools/tools-provider.module.ts` — registered `edit_workspace_file` (description in English, `estimatedLatency: slow`, `timeoutMs: 60000`)

## Flow
```
list_workspace_files → read_workspace_file → edit_workspace_file → read (verify)
```

## Tests
- `npx tsc --noEmit` (apps/api) — ✅ clean
- `npx vitest run` — ✅ 61/61 pass
- Live QA (temp workspace, rekap file copy):
  - Goal: "update laporan hari ini tanggal 16 April 2025, tambahkan transaksi CK ANDI = 500RB(BCA) [ 5 PCS ]"
  - Result: `edit_workspace_file` success, 5 changes applied
  - `fileHasAndi: true`, `fileHasNewDate: true`, `keptOldData: true` — rollover done, cumulative data kept
  - One redundant second `edit_workspace_file` (error, oldText not found) from LLM loop trying a second pass — non-blocking, self-healing caught it

## Notes
- Note: pulled upstream first (fast-forward to `5a02d26`) — added `ARUNAKI_API_KEY` + `ARUNAKI_VAULT_KEY` to local `.env` (required by new AuthGuard + SecretsVaultService; `.env` is gitignored, not committed).
- Live QA must send `x-api-key` header and run API + test in ONE shell command (background process dies when shell exits).
- Follow-up: LLM sometimes fires a second redundant edit after success; could instruct "apply all changes in ONE edit call" if it recurs.
