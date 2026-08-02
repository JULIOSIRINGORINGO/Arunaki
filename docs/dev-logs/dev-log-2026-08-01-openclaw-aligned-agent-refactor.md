# Dev Log — OpenClaw-Aligned Agent Refactor (Regex Removal → LLM-Driven + Lean Context)

**Date & Time:** 2026-08-01
**Author:** OpenCode Agent
**Commits:** `87498c3`, `91683c3`, `6f1fa97`, `bcc76dc`, `b403e22`, `7e25022`, `8f0e6af`, `fcafe05`, `42905a7`

## What
Refactored Arunaki workspace agent to match OpenClaw's actual architecture (verified against `E:\JS\OpenClaw\openclaw-repo` `packages/agent-core/src/agent-loop.ts`): LLM-driven tool selection via native Function Calling, no deterministic intent classifier, no separate planner, lean modular context, complete tool set.

## Root Cause
1. Regex intent routing (`isWriteIntent`/`isDirectIntent`) misclassified "ganti nama" as write → goal mutation (rename became create).
2. Separate LLM planning call added ~4s latency and produced fabricated plans.
3. Dead orchestration layers (AgentRuntime, AutonomousPlanner, SelfEvaluation) registered but never called — boot weight + confusion.
4. `write_workspace_file` reported "berhasil dibuat" even when overwriting an existing file (inconsistent with final reply "diperbarui").
5. Tool schema descriptions were Indonesian — English is more accurate for LLM tool selection.
6. UI step labels were hardcoded ("Rencana Otonom: N Langkah (Sub-Agents)") — did not reflect actual backend events, and steps were lost on session switch.

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — removed regex routing + planner call; `plan_created` from real round-1 tool calls (multi-step only); lean context (dropped eager domain injection, auto file-preview pre-read); `write_workspace_file` created/updated status via `storageService.exists`
- `apps/api/src/modules/tools/services/workspace-tools.service.ts` — added `renameWorkspaceFile` (fs.rename + DB index update); created/updated detection
- `apps/api/src/modules/tools/tools-provider.module.ts` — registered `rename_workspace_file`; 183 description fields translated English
- `apps/api/src/modules/file/file.service.ts` — added generic `update()`
- `apps/api/src/modules/ai/ai.module.ts`, `apps/api/src/modules/workspace/workspace.module.ts` — removed AgentRuntime/planner/evaluator wiring
- `apps/api/src/modules/chat/agent-runner.service.ts` — removed unused plannerService inject
- Deleted: `agent-runtime/` (6 files), `autonomous-planner.service.ts`, `self-evaluation.service.ts`
- `apps/api/src/modules/interaction/desktop-bridge.service.ts` + `interaction.module.ts` — port via `@Optional @Inject(DESKTOP_BRIDGE_PORT)` (Nest boot fix)
- `apps/web/src/pages/WorkspacePage.tsx` — honest step labels from backend event data; steps persisted per session + restored; text_delta→analysisResult (output separate from timeline)
- `apps/web/src/pages/WorkspaceDetailPage.tsx` — honest plan label

## Tests
- `npx vitest run` (apps/api) — ✅ 56/56 pass (incl. desktop-bridge fix: unique port per test)
- `npx tsc --noEmit` (apps/api) — ✅ 0 source errors
- `npx tsc --noEmit` (apps/web) — ✅ clean
- Live QA (isolated temp workspace): create → rename → delete all pass; rename tool verified (`test.txt`→`test2.txt`, content preserved); created/updated status accurate; SSE trace confirms poem content never enters timeline events

## Notes
- OpenClaw has NO intent classifier/planner in agent-core — verified by grep (0 matches for IntentClassifier/classifyIntent/plan in `agent-loop.ts`). "Framework does more" = good tools + modular prompt + no extra LLM calls.
- `plan_created` now emitted only for multi-step (round > 1 or >1 tool in round 1).
- Tool schema English; `displayName` Indonesian; user-facing replies follow user language via `identity.md` rule.
- Follow-up: LLM occasionally calls `write_workspace_file` with empty args (`{}`) → self-healing retries (free-tier model quirk, not a code bug).
