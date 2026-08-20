# Dev Log — LLM-Based Intent Classification & E2E Validation

**Date & Time:** 2026-08-20 16:05:00 WIB
**Author:** AI Agent

## What
Refactored the brittle regular expression-based intent classification for tools inside the Workspace Agent Engine. Previously, tools like `desktop_excel_edit` required rigid keywords ("ubah", "edit") which failed easily if users used different vocabulary or structure.

We integrated an asynchronous call `AiService.classifyIntent` right in `buildInitialContext()` of `WorkspacePromptBuilderService` that offloads the intent analysis to a fast LLM.

## Files Changed
- `apps/api/src/modules/ai/ai.service.ts` — Added `classifyIntent(prompt, tools)`.
- `apps/api/src/modules/workspace/services/workspace-prompt-builder.service.ts` — Made `buildInitialContext` async, dropped static regex, await `classifyIntent`.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Await builder, passed down strongly typed flags.
- `WORKFLOW.md` — Appended Phase 55.

## Tests
- `npx --yes tsx apps/api/scripts/test-excel-structure-preservation.ts` — ✅ passed (The Excel logic wrote successfully via `desktop_excel_edit` tool)
- Verified target `TABEL REKAPAN NEW2026-.xlsm` to ensure 100% layout and structure preservation (Merges count exactly matching).

## Notes
The execution of the E2E verification successfully mutated Excel data without corrupting any format. DeepSeek V4 Flash successfully generated the intent flag `isMutation: true` dynamically.
