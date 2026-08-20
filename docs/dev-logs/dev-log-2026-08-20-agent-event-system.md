# Dev Log — Phase 56: Dedicated Agent Event System

**Date & Time:** 2026-08-20 18:55:00 WIB
**Author:** opencode

## What
Phase 56 Critical Security & Production Optimization. 56.1 (path traversal) and 56.2 (memory consolidation) were already implemented. 56.3 (agent event system) was not — EventEmitter2 was used raw with string literals across 4 files, inconsistent payload shapes, no abstraction.

## Files Changed
- `apps/api/src/modules/workspace/services/agent-event.service.ts` — **NEW**. Centralized event constants (`AgentEvents`) + typed payload interfaces + thin wrapper around EventEmitter2.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Replaced `EventEmitter2` import/injection with `AgentEventService`. 4 emit calls replaced with typed methods.
- `apps/api/src/modules/workspace/services/workspace-run-state.service.ts` — Replaced `EventEmitter2` with `AgentEventService`. 2 emit calls replaced.
- `apps/api/src/modules/workspace/services/time-travel.service.ts` — Replaced `EventEmitter2` with `AgentEventService`. 1 emit call replaced.
- `apps/api/src/modules/workspace/services/workspace-rules-sentinel.service.ts` — `@OnEvent` decorator now uses `AgentEvents.AGENT_COMPLETED` constant.
- `apps/api/src/modules/workspace/workspace.module.ts` — Registered `AgentEventService` in providers + exports.
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — Updated mock from `EventEmitter2` to `AgentEventService`.
- `apps/api/src/modules/workspace/services/transcript-engine.service.spec.ts` — Updated mock from `{ emit: vi.fn() }` to `{ emitRollback: vi.fn() }`.

## Tests
- `npx nest build` — 0 errors
- `npx vitest run src/modules/workspace/` — 20/20 passed (3 test files)

## Notes
- 56.1: Path traversal guards already existed in all 5 tool services (read/write/edit/delete/rename) + centralized `requirePathInWorkspace` in workspace-tools.service.ts. No new code needed.
- 56.2: `AutoMemoryService` already has `distill()`, `mergeSimilarMemories()`, `checkAndDistill()`. The WORKFLOW description asked for `consolidateMemories()` but the equivalent exists under different names.
- 56.3: Skipped wrapping EventEmitter2 in yet another abstraction layer — created typed constants + interfaces + thin emit helpers instead. The `@OnEvent` decorator still uses EventEmitter2 directly (NestJS requirement). The `AgentFailedEvent` now has optional `reason?` and `error?` fields to unify the two previously inconsistent call sites.
