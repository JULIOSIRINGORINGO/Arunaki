# Dev Log — Fix Part 5 Gap Analysis (Mutating Tools Drift)

**Date & Time:** 2026-08-05 15:30:00 WIB
**Author:** Antigravity

## What
- Fixed the most critical safety bypass bug (Issue #22) where `edit_workspace_file`, `rename_workspace_file`, and `desktop_excel_edit` were missing from the `mutatingTools` list due to naming drift.
- Replaced the local `mutatingTools` array inside `runWorkspaceAgentStream` with a module-level exported constant `WORKSPACE_MUTATING_TOOLS` for testability and reuse.
- Updated the `MUTATING_TOOLS` constant in `tool-registry.service.ts` to match the exact same valid tool names.
- Added a static verification test in `workspace-runner.service.spec.ts` to explicitly check that `WORKSPACE_MUTATING_TOOLS` contains the expected exact tool names, preventing future drift.

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Extracted and fixed `WORKSPACE_MUTATING_TOOLS`.
- `apps/api/src/modules/tools/tool-registry.service.ts` — Fixed `MUTATING_TOOLS`.
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — Added static verification test for the mutating tools array.
- `GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md` — Marked items for Fix #22 as complete.

## Tests
- `npx vitest run src/modules/workspace src/modules/tools` — ✅ passed (28 tests)

## Notes
- All mutating tools now correctly trigger the safety guards (mention check, delete intent check, and checkpoint rollback).
