# Agent Architecture — OpenClaw vs Arunaki

> **UPDATE 2026-07-29:** Deskripsi Arunaki di bawah ini adalah keadaan **SEBELUM Phase 24**. Setelah Phase 24, Arunaki sudah memiliki:
> - Dual-loop agent (outer loop steering + inner loop tool calls)
> - AbortController per workspace
> - Steering queue (`addSteeringInput()` + `POST .../agent/steer`)
> - Execution phase tracking (`ExecutionPhase` + SSE `phase_changed`)
> - Context refresh setiap 5 rounds via `prepareNextTurn()`
> - SelfHealing terintegrasi untuk read-only tools
> - PromptInjection detection (high=block, low/medium=sanitize)
> 
> **Dokumen ini tetap dipertahankan** sebagai referensi pola OpenClaw untuk pengembangan ke depan.

## Executive Summary

OpenClaw's agent is a **dual-loop state machine** with steering, abort handling, and event-driven communication. Pre-Phase 24, Arunaki's agent was a **single-loop tool caller** with no state management, no abort, and no steering. This document explains both designs for reference.

---

## OpenClaw Agent Architecture

### Core Design: Dual-Loop Agent

```
┌─────────────────────────────────────────────────┐
│  Outer Loop (Steering / Follow-up)              │
│  ┌─────────────────────────────────────────────┐ │
│  │  Inner Loop (Tool Calls)                    │ │
│  │  ┌─────────────────────────────────────────┐│ │
│  │  │  streamAssistantResponse()              ││ │
│  │  │  → Parse text + tool calls              ││ │
│  │  │  → Execute tools (parallel/sequential)  ││ │
│  │  │  → Emit events                          ││ │
│  │  │  → Loop if tool calls present           ││ │
│  │  └─────────────────────────────────────────┘│ │
│  │  → prepareNextTurn() hook                  │ │
│  │  → Steering check (user input during run)  │ │
│  │  → Follow-up decision                      │ │
│  └─────────────────────────────────────────────┘ │
│  → afterTurn() lifecycle hook                    │
│  → State cleanup                                 │
└─────────────────────────────────────────────────┘
```

### Key Files (OpenClaw)
- `agent-loop.ts` — `runLoop()`, `streamAssistantResponse()`, `executeToolCalls()`
- `Agent.ts` — Agent class with state management, steering, abort
- `agent-event.ts` — Event system for progress reporting

### Agent State Machine

```typescript
// OpenClaw Agent states
type AgentState =
  | 'idle'           // Not running
  | 'running'        // Actively processing
  | 'steering'       // User provided input during execution
  | 'aborting'       // Graceful shutdown requested
  | 'completed'      // Finished successfully
  | 'failed';        // Error occurred
```

### Steering System

OpenClaw allows users to provide input **while the agent is running**:

1. User sends a message while agent is executing tools
2. Agent detects the new message in the `steeringQueue`
3. Current tool execution completes (doesn't interrupt mid-tool)
4. Agent injects the steering message into the conversation
5. Agent continues with the new context

**Arunaki equivalent (sekarang):** ✅ **Sudah ada.** Dual-loop dengan `steeringQueue` Map + `POST /workspaces/:id/agent/steer` endpoint. User bisa kirim steering input selama agent berjalan. Implementasi di Phase 24.

### Abort Handling

```typescript
// OpenClaw abort pattern
agent.abort('User cancelled');  // Graceful: finish current tool, then stop
agent.abort('Timeout', true);   // Forceful: stop immediately

// In the loop:
if (this.abortController.signal.aborted) {
  break;  // Exit cleanly, save partial results
}
```

**Arunaki equivalent (sekarang):** ✅ **Sudah ada.** AbortController per workspace. Dual-loop mengecek `abortController.signal.aborted` setiap iterasi. Implementasi di Phase 24.

### Event System

OpenClaw emits structured events for every lifecycle moment:

```typescript
// OpenClaw events
'agent_thinking'      // Agent is processing
'agent_tool_start'    // Tool execution beginning
'agent_tool_done'     // Tool execution complete
'agent_text_delta'    // Streaming text chunk
'agent_steering'      // User input received during run
'agent_error'         // Error occurred
'agent_completed'     // Agent finished
```

**Arunaki events:** `thinking`, `plan_created`, `tool_start`, `approval_required`, `tool_done`, `text_delta`, `done`, `error`. Similar but no `steering` or lifecycle events.

### Tool Execution Flow

```
1. Agent calls LLM with messages + tools
2. LLM returns text + tool_calls array
3. Agent separates: read-only (parallel) vs mutating (sequential)
4. Read-only tools: execute all in parallel via Promise.all()
5. Mutating tools: execute one-by-one, each requiring approval
6. Tool results added to messages array
7. Loop back to step 1 (unless no tool_calls → exit)
```

### prepareNextTurn Hook

After each inner loop iteration, OpenClaw calls `prepareNextTurn()`:
- Injects fresh context (file changes, memory updates)
- Checks if steering input arrived
- Decides if follow-up is needed
- Updates token budget

**Arunaki equivalent:** None. Context is built once at start, never refreshed mid-run.

---

## Arunaki Agent Architecture (Current)

### Core Design: Single-Loop Tool Caller

```
┌─────────────────────────────────────────┐
│  runWorkspaceAgentStream()              │
│  ┌─────────────────────────────────────┐ │
│  │  buildWorkspaceContext()            │ │  ← Built ONCE at start
│  │  plan = AI.generatePlan()           │ │  ← Separate LLM call
│  │  for round = 0..25:                 │ │
│  │    response = AI.chat(messages)     │ │
│  │    if no tool_calls: break          │ │
│  │    execute read-only (parallel)     │ │
│  │    execute mutating (sequential)    │ │
│  │    add results to messages          │ │
│  │  selfEvaluationService.evaluate()   │ │
│  │  save to DB                         │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### What's Missing vs OpenClaw

| Feature | OpenClaw | Arunaki | Impact |
|---------|----------|---------|--------|
| Dual-loop | Outer (steering) + Inner (tools) | Single loop | No mid-run user input |
| State machine | 6 states with transitions | None (running/done) | No lifecycle management |
| Abort/cancel | Graceful + forceful | None | Can't stop long runs |
| Steering queue | User input during execution | Ignored until done | Poor UX for long tasks |
| prepareNextTurn | Fresh context each iteration | Context built once | Stale data after round 10 |
| Event system | Full lifecycle events | Basic progress only | No debugging/monitoring |
| Token budget | Dynamic per-turn allocation | Fixed 128k total | Inefficient token use |
| Error recovery | Retry with backoff | Fail and stop | Fragile execution |

---

## Target Architecture for Arunaki

### Phase 1: Add Abort + State Machine

```typescript
// New: AgentState enum
enum AgentState {
  IDLE = 'idle',
  RUNNING = 'running',
  STEERING = 'steering',
  ABORTING = 'aborting',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// New: AbortController per run
class WorkspaceRunnerService {
  private activeRuns = new Map<string, AbortController>();

  abortRun(workspaceId: string, reason: string) {
    const controller = this.activeRuns.get(workspaceId);
    if (controller) controller.abort(reason);
  }
}
```

### Phase 2: Add Steering Queue

```typescript
// New: Steering input buffer
interface SteeringInput {
  workspaceId: string;
  message: string;
  timestamp: Date;
}

// In the loop:
if (this.steeringQueue.has(workspaceId)) {
  const input = this.steeringQueue.get(workspaceId);
  messages.push({ role: 'user', content: input.message });
  this.steeringQueue.delete(workspaceId);
}
```

### Phase 3: Add prepareNextTurn

```typescript
// After each round, refresh context
async prepareNextTurn(workspaceId: string, messages: ChatMessage[]) {
  // Re-read changed files
  const newContext = await this.buildWorkspaceContext(workspaceId);
  // Inject as system message if significantly different
  // Update token budget
  // Check for steering input
}
```

### Phase 4: Add Full Event System

```typescript
// Expand WorkspaceStreamEvent types
type WorkspaceStreamEvent =
  | { type: 'thinking'; data: string }
  | { type: 'plan_created'; data: { goal: string; steps: string[] } }
  | { type: 'tool_start'; data: { toolName: string; args: any } }
  | { type: 'tool_done'; data: { toolName: string; result: ToolResult } }
  | { type: 'text_delta'; data: string }
  | { type: 'steering_received'; data: { message: string } }  // NEW
  | { type: 'state_changed'; data: { from: AgentState; to: AgentState } }  // NEW
  | { type: 'token_usage'; data: { used: number; budget: number } }  // NEW
  | { type: 'done'; data: { content: string; artifacts: any[] } }
  | { type: 'error'; data: { message: string } };
```

---

## Key Insight

**OpenClaw works with free models because its architecture is clean and lightweight.** The agent loop is simple: call LLM → execute tools → loop. No heavy services, no complex compression, no multiple LLM calls per round.

**Arunaki struggles with free models because its architecture is heavy.** Every round: context compression (4 phases), model routing, posture detection, injection detection, self-evaluation. Free models can't handle the complexity.

**The fix is not "use a better model" — it's "simplify the architecture."**
