# Dev Log — Phase 6: Blueprint P2 Medium

**Date:** 2026-07-29
**Author:** AI Agent

## What
Completed Blueprint P2 Medium items:
- F. Extract `runWithModelFallback` (Layer 2) — standalone factory function
- G. Wire Workspace Heartbeat (Layer 29) — register from connectFolder()

## Files Changed
- `apps/api/src/modules/ai/model-fallback.ts` — NEW: runWithModelFallback() + FallbackOptions interface
- `apps/api/src/modules/ai/ai.service.ts` — Refactored chat() to delegate fallback logic
- `apps/api/src/modules/workspace/workspace.service.ts` — Wire heartbeat into connectFolder()
- `WORKFLOW.md` — Mark Phase 6 ✅, update Current Status
- `docs/FIXES-AND-GAPS.md` — Mark F and G as ✅ Done
- `docs/dev-logs/dev-log-2026-07-29-phase-6-blueprint-p2-medium.md` — This file
- `docs/FIXES-AND-GAPS.md` — Updated ARCHITECTURALLY WRONG section to ✅

## Tests
- `npx tsc --noEmit` — ✅ passed (only pre-existing .spec.ts errors)

## Notes
- Phase 6 completes all P2 Medium items. Next: Phase 7 — Blueprint P3 Low (Auto Memory Cron, LLM Stream Inline).
- SelfEvaluationService import in workspace-runner.service.ts was already removed in Phase 28.
- The `jitteredBackoff` private method still exists in AiService but is no longer called — kept for backward compatibility.
