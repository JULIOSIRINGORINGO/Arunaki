# ROADMAP — Arunaki Implementation Plan

## Context

After deep-diving into OpenClaw's source code, we discovered that Arunaki's AI quality problem is **architectural, not model-related**. OpenClaw works with the same free models (nemotron, etc.) because its architecture is clean and lightweight. Arunaki's architecture is too heavy for free models to handle.

This roadmap fixes the architecture in 5 phases, ordered by impact.

---

## Phase 1: Fix Critical Architecture (Week 1) ✅ SELESAI

**Goal:** Make the agent loop functional and controllable.

### 1.1 Add Abort/Cancel Capability ✅
**Files:** `workspace-runner.service.ts`, `workspace.controller.ts`

- Add `AbortController` per workspace run
- Add `POST /workspaces/:id/agent/abort` endpoint
- Check `abortController.signal.aborted` in the agent loop
- Frontend: Add cancel button during analysis

**Why:** Users can't stop long-running analysis. This is critical UX.

### 1.2 Add State Machine ✅
**Files:** `workspace-runner.service.ts`

- Add `AgentState` type: idle, running, steering, aborting, completed, failed
- Track state per workspace run via `WorkspaceRunState` interface
- Emit state change events via `onEvent()`
- `getRunState()`, `isRunning()`, `getAllActiveRuns()` for monitoring

**Why:** No lifecycle management means no debugging, no monitoring, no control.

### 1.3 Fix Approval Gate to Wait ✅
**Files:** `workspace-runner.service.ts`, `workspace.controller.ts`, `WorkspaceDetailPage.tsx`

- Queue-based approval: `waitForApproval()` returns Promise, resolved by `resolveApproval()`
- New `POST /workspaces/:id/agent/approve` endpoint
- Frontend calls approve endpoint instead of re-creating stream
- No more `pausedRuns` Map — state preserved in loop's closure

**Why:** Previously, approval gate killed the entire agent loop.

### 1.4 Integrate SelfHealingService ✅
**Files:** `workspace-runner.service.ts`

- All tool calls go through `selfHealingService.executeWithHealing()`
- Auto error recovery with fallback tools

**Why:** SelfHealingService existed but was never used.

---

## Phase 2: Fix Broken Functionality (Week 2)

**Goal:** Make existing features work correctly.

### 2.1 Fix tiktoken Encoding
**Files:** `ai.service.ts`

- Change `encoding_for_model('gpt-4')` to detect model family
- Use appropriate encoding per model (cl100k_base for most)

**Why:** Token counting is inaccurate for non-GPT models.

### 2.2 Add Early Exit to Compression
**Files:** `context-manager.ts`

- Add check: if tokens < threshold, return messages immediately
- Skip all compression phases when not needed

**Why:** Compression runs on every `chat()` call, wasting CPU.

### 2.3 Disable LLM Summary in Compression
**Files:** `ai.service.ts`

- Change `useLlmSummary: true` to `false`
- Use template-based summary only

**Why:** LLM summary wastes tokens and triggers rate limits on free models.

### 2.4 Fix StreamingContextScrubber Patterns
**Files:** `context-manager.ts`

- Update regex patterns for Indonesian context (remove Chinese characters)
- Add Indonesian terms for memory/skill detection

**Why:** Current patterns don't match Indonesian content.

---

## Phase 3: Fix Architecture Mistakes (Week 3)

**Goal:** Simplify the architecture to work with free models.

### 3.1 Remove Separate Planning Call
**Files:** `workspace-runner.service.ts`

- Remove the separate `aiService.chat()` for planning
- Let the LLM generate a plan as part of its first response
- Update workspace-rules.md to guide planning

**Why:** Planning wastes a full LLM round-trip. OpenClaw doesn't do this.

### 3.2 Remove Separate Self-Evaluation
**Files:** `workspace-runner.service.ts`

- Remove `selfEvaluationService.evaluate()` after the loop
- Let the agent's natural flow handle quality
- Keep self-evaluation as optional, not mandatory

**Why:** Self-evaluation wastes tokens and triggers extra LLM calls.

### 3.3 Simplify ModelRouter Additions
**Files:** `model-router.service.ts`

- Reduce system prompt additions to essential rules only
- Remove model-specific reminders (LLMs know their format)

**Why:** Model-specific bloat wastes tokens for free models.

### 3.4 Skip Posture Detection in Workspace Mode
**Files:** `ai.service.ts`

- Only run `detectPostureFromHistory()` in chat mode
- Workspace mode uses workspace-rules.md instead

**Why:** Posture detection wastes CPU in workspace mode.

### 3.5 Integrate PromptInjectionDetector
**Files:** `workspace-runner.service.ts`

- Scan `userGoal` before processing
- Block high-severity injections
- Sanitize and log medium-severity injections

**Why:** Injection detection exists but is never used.

---

## Phase 4: Complete Incomplete Features (Week 4)

**Goal:** Make existing features more effective.

### 4.1 Add Context Refresh Per Turn
**Files:** `workspace-runner.service.ts`

- Add `prepareNextTurn()` method
- Refresh context every 5 rounds
- Inject fresh file list and memories

**Why:** Context gets stale during long runs.

### 4.2 Add Memory Consolidation
**Files:** `memory.service.ts`

- Add `consolidateMemories()` method
- Merge similar memories when count > 100
- Add relevance scoring to smart recall

**Why:** Memory grows unbounded and loses relevance.

### 4.3 Add Domain Config Injection
**Files:** `workspace-runner.service.ts`

- Load domain config from registry
- Inject into workspace context
- Add domain-specific examples to prompts

**Why:** 15 domain templates exist but aren't used.

### 4.4 Add Workspace Isolation Enforcement
**Files:** Tool execution layer

- Validate all file paths against workspace root
- Block access to paths outside workspace
- Log isolation violations

**Why:** Security requirement — agent must only access workspace.

---

## Phase 5: Add Missing Features (Week 5+)

**Goal:** Add features that OpenClaw has but Arunaki lacks.

### 5.1 Add Event System
**Files:** `workspace-runner.service.ts`, new `agent-event.service.ts`

- Implement EventEmitter-based event system
- Emit events for every lifecycle moment
- Frontend: Subscribe to events for real-time updates

### 5.2 Add Streaming Tool Results
**Files:** Tool execution layer

- Stream large tool results incrementally
- Show progress in frontend
- Reduce memory usage for large outputs

### 5.3 Dynamic Skills
**Files:** `skill.service.ts`

- Add runtime skill loading
- Allow skill composition
- Add skill versioning

### 5.4 Cron Scheduler Integration
**Files:** `cron-scheduler.service.ts`, `workspace-runner.service.ts`

- Connect scheduler to agent loop
- Add UI for managing scheduled tasks
- Persist tasks across restarts

---

## Success Metrics

After completing all phases:

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Free model quality | Poor (2-3/10) | Good (7-8/10) | User satisfaction survey |
| Analysis completion rate | ~60% | ~95% | Track `done` vs `error` events |
| Average analysis time | 5-10 min | 2-3 min | Measure `runWorkspaceAgentStream` duration |
| User can cancel | No | Yes | Test abort endpoint |
| Context freshness | Stale after round 1 | Fresh every 5 rounds | Log context refresh calls |
| Token waste | ~30% overhead | ~10% overhead | Compare token usage before/after |

---

## Documentation Index

- `docs/AGENT-ARCHITECTURE.md` — Agent system design (OpenClaw vs Arunaki)
- `docs/CONTEXT-ENGINE.md` — Context management design
- `docs/TOOL-SYSTEM.md` — Tool system design
- `docs/FIXES-AND-GAPS.md` — Every gap with specific fix instructions
- `AUDIT.md` — Full comparison document with tables
