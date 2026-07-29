# Phase 24: Agent Loop Hardening — Dual-Loop, Steering, Context Refresh, PromptInjection

## 2026-07-29

### Changes Made

**1. Dual-Loop Agent (Steering + Tool Calls)**
- Restructured single `for` loop to dual-loop:
  - Outer loop (max 5 turns): checks for steering/follow-up inputs between turns
  - Inner loop (max 25 rounds per turn): tool execution + AI chat
- Added `steeringQueue` Map for mid-run follow-up injection
- Added `addSteeringInput(workspaceId, message)` method
- Added `POST /workspaces/:id/agent/steer` endpoint

**2. Context Refresh per Turn**
- Added `prepareNextTurn()` method
- Refreshes workspace context every 5 rounds via `buildWorkspaceContext()`
- Injected as `[Context Refreshed - Round N]` system message

**3. SelfHealingService for Read-Only Tools**
- Previously only used for mutating tools (approval gate path)
- Now wraps read-only tool execution with `executeWithHealing()` too
- Replaced `executeParallel()` with sequential `executeWithHealing()` per read-only tool

**4. PromptInjectionDetector Integration**
- Scans `userGoal` at start of `runWorkspaceAgentStream()`
- High severity → blocks execution with error message
- Low/medium severity → sanitizes and continues

### Files Modified
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Major restructure
- `apps/api/src/modules/workspace/workspace.controller.ts` — Added steer endpoint

### Verification
- Build: PASSED (0 errors)

### Next
- Code review and testing of dual-loop behavior
