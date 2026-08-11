# Dev Log — Rekap Harness Hardening + Edit Tool Convergence

**Date & Time:** 2026-08-11
**Author:** AI agent (opencode-style tooling pass)

## What

Two related pieces of work landed on `main` today:

1. **Harness read context + E2E bound** (commit `3499311`)
   - `ToolResultFormatter` now sends the full parsed document body back to the model for the `read` tool (capped at 12 000 chars) instead of the 500-char preview. Other tools keep their preview path.
   - `WorkspaceRunnerService` tracks files already pre-read via `readMentionedFiles` and rejects re-reading the same target inside one run — generic, no per-file rules.
   - `WorkspaceController.streamAgent` forwards the request's `modelId` to the runner so HTTP callers actually pick the model they asked for.
   - `scripts/test-rekap-extended.ts` switched to HTTP-only with an explicit 90 s `AbortController`, requires `ARUNAKI_API_KEY`, surfaces real HTTP status/body, and no longer silently falls back to a different Nest context that bypasses auth and `modelId`.

2. **Edit tool convergence on OpenCode pattern** (uncommitted, to be committed next)
   - `EditToolService` rewritten from the dual-mode (string replace + `*** Begin Patch` engine) into a single `path / oldString / newString / replaceAll` operation that matches OpenCode's `edit.ts` 1:1 — same line-ending normalisation, BOM handling, and occurrence-count validation.
   - The custom patch parser, the `apply_patch` alias, and the smart-content fallback are removed. No filename-specific, language-specific, or report-specific logic.
   - `ToolsProviderModule` registers `edit` with the new schema and drops the `apply_patch` duplicate registration. Tool description now matches OpenCode's plain targeted-edit language.

## Files Changed

- `apps/api/src/modules/tools/utils/tool-result-formatter.ts` — full content path for `read`.
- `apps/api/src/modules/tools/utils/tool-result-formatter.spec.ts` — new spec covering both paths.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — `readTargets` guard.
- `apps/api/src/modules/workspace/workspace.controller.ts` — forward `modelId`.
- `apps/api/scripts/test-rekap-extended.ts` — HTTP-only with 90 s abort.
- `apps/api/src/modules/tools/services/edit-tool.service.ts` — OpenCode-faithful rewrite.
- `apps/api/src/modules/tools/services/workspace-tools.service.ts` — method signature updated.
- `apps/api/src/modules/tools/tools-provider.module.ts` — new schema, `apply_patch` removed.

## Tests

- `npx tsc --noEmit -p apps/api/tsconfig.build.json` — clean.
- `npx vitest run src/modules/tools/utils/tool-result-formatter.spec.ts src/modules/workspace/workspace-runner.service.spec.ts` — 10 / 10 pass.
- E2E run against the realtime template (`E:\LAPORAN\REKAPAN TERBARU2.txt`, not restored):
  - One `edit` call, no `read` loop.
  - 10 / 12 checks pass.
  - Remaining: agent did not write the individual `PENGELUARAN` lines and left `UANG DI LACI` at `0 RB`. Out of scope for this pass — fixing either would reintroduce hardcoded report rules.

## Notes

- The harness changes are deliberately generic (formatter caps, `readTargets`, `modelId` pass-through, 90 s test deadline). They make no assumption about reports, totals, or file structure.
- The edit-tool rewrite is still a behaviour change for any caller that was sending `filename / patchText`. The agent prompt already emits `path / oldString / newString`, and the controller keeps both snake_case and camelCase fallbacks (`oldText` / `old_string`) so older tool-call shapes are accepted as `oldString`.
- Follow-up, not in this push: make the agent actually fill the `PENGELUARAN` rows and the `UANG DI LACI` line. The hook for that lives in the LLM-side edit-diff prompt and instruction phrasing — not in framework code.