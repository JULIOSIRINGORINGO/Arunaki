# Agent Runtime Implementation Plan

**Goal:** Add orchestration layer (intent classifier, plan graph, verifier, recovery, replanner) over existing engine without breaking workspace tool flow.

**Architecture:** Compatibility-first. `AgentRuntime` orchestrates nodes; `WorkspaceRunnerService` remains executor backend until phase complete.

**Tech Stack:** TypeScript, NestJS, existing ToolRegistry, SelfHealingService, AiService, SessionStateEventsService, Prisma.

---

## Phase 1: Contracts + Verifier + Planner/Replanner

### New files
- `apps/api/src/modules/agent-runtime/agent-runtime.module.ts`
- `apps/api/src/modules/agent-runtime/runtime.types.ts` — `AgentIntent`, `PlanGraph`, `PlanNode`, `NodeStatus`, `VerificationResult`, `RuntimeContext`
- `apps/api/src/modules/agent-runtime/runtime.contracts.ts` — `TaskClassifier`, `PlanGraph`, `Verifier`, `RecoveryManager` interfaces
- `apps/api/src/modules/agent-runtime/verifier.service.ts` — workspace-aware verify after write/edit/delete
- `apps/api/src/modules/agent-runtime/planner.service.ts` — wraps `AutonomousPlannerService`, adds plan graph creation and node transition

### Modify (minimal)
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — emit `plan_created` from plan graph, emit `verified`, `recovery`, `replanner` SSE events
- `apps/api/src/modules/ai/ai.module.ts` — register new services

### Plan flow (compatibility)
1. `AgentRuntime.intent(intentGoal, context)` → `AgentIntent` JSON
2. `AgentRuntime.createPlan(intent)` → `PlanGraph` with 1-N nodes
3. `AgentRuntime.executeNext(node)` → executor (existing tool chain for workspace file ops)
4. `AgentRuntime.verifier.verify(node, result)` → `VerificationResult`
5. On fail → `AgentRuntime.recovery.handle(node, error)` → replanner or node skip
6. On pass → next node or `done`

### Verification focus
- workspace file ops: path in workspace, exact filename, content hash/content type check
- desktop ops: result metadata check
- LLM ops: tool result success and content present

---

## Phase 2: Wire Session Events + Runtime Trace

### Modify
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — emit per-node trace through SSE
- Add `PlanExecutionAgentEvent` type: `plan_node_started`, `plan_node_verified`, `plan_node_failed`, `plan_node_recovery`, `plan_node_replanned`
- Add agent runtime context to `SessionStateEventsService` records (reuse existing)

### Verify
- vitest 45 pass
- tsc clean
- live QA create/edit/delete with trace events
