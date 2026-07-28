# CRITICAL FINDINGS: OpenClaw Sessions Layer

**Date:** 2026-07-28
**Purpose:** Critical patterns for Arunaki business autonomy
**Status:** EXHAUSTIVE ANALYSIS FROM SOURCE CODE ✅

---

## EXECUTIVE SUMMARY

OpenClaw Sessions layer adalah **THE MOST CRITICAL** untuk business autonomy. Ini yang membedakan agent yang "bisa concurrent" vs "corrupt transcript".

**Key Discovery:** Arunaki **MISSING** session-level admission queue. Current implementation hanya workspace-level, bukan session-level.

---

## CRITICAL GAP: SESSION-LEVEL WORK ADMISSION

### Current Arunaki (INCOMPLETE)
```typescript
// workspace-runner.service.ts
isRunning(workspaceId): boolean {
  return this.activeRuns.has(workspaceId)
}
```
**Problem:** Blocks concurrent runs per **workspace**, not per **session**.

### OpenClaw Pattern (CORRECT)
```typescript
// session-lifecycle-admission.ts
beginSessionWorkAdmission(params: {
  scope: string,              // "agent:<id>" namespace
  identities: Iterable<string>, // session keys/IDs
  signal?: AbortSignal
}): Promise<SessionWorkAdmissionLease>
```
**Solution:** Queue-based admission with lease pattern, session-level locking.

---

## CRITICAL PATTERNS FOR ARUNAKI

### 1. WORK ADMISSION QUEUE (P0 - MUST IMPLEMENT)

**Flow:**
```
User Request 1 (sessionA) → admitted → running
User Request 2 (sessionA) → queued (waiting for #1)
User Request 3 (sessionB) → admitted (different session, parallel OK)
```

**Implementation Checklist:**
- [ ] Create `SessionAdmissionService` (@Injectable)
- [ ] Global singleton state: `Map<sessionKey, AdmissionState>`
- [ ] `beginAdmission(sessionKey, signal)` → lease or queue
- [ ] `SessionAdmissionLease` with `release()` method
- [ ] Timeout: 15s default (configurable)
- [ ] Integrate into `AgentRunnerService.runAgentStream()`

**Code Pattern:**
```typescript
async runAgentStream(params) {
  const lease = await sessionAdmissionService.beginAdmission(
    params.sessionKey, 
    abortSignal
  )
  
  try {
    // Agent loop here
    // ...
  } finally {
    await lease.release()
  }
}
```

---

### 2. IDEMPOTENT TRANSCRIPT RECORDING (P0 - MUST IMPLEMENT)

**Current Arunaki:** No idempotency, duplicate messages possible on retry.

**OpenClaw Pattern:**
```typescript
buildRunUserTurnIdempotencyKey(runId): string {
  return `run:${runId}`
}

// In persistence:
const existing = findByIdempotencyKey(key)
if (existing) return existing // Skip duplicate
```

**Implementation Checklist:**
- [ ] Add `idempotencyKey` field to Message model
- [ ] Generate key: `run:${runId}` or `turn:${chatId}:${timestamp}`
- [ ] Check before insert: `findFirst({ idempotencyKey })`
- [ ] Skip if exists, return existing message

---

### 3. INPUT PROVENANCE (P0 - SECURITY)

**Why Critical:** Prevents prompt injection via cross-session routing.

**OpenClaw Pattern:**
```typescript
InputProvenance {
  kind: "external_user" | "inter_session" | "internal_system"
  sourceSessionId?: string
  sourceTool?: string
  isUser?: boolean
}

// For inter-session:
"[Inter-session message] sourceSession=abc123 isUser=false"
```

**Implementation Checklist:**
- [ ] Add `provenance` JSON field to Message model
- [ ] Track provenance on message creation
- [ ] Annotate inter-session messages with prefix
- [ ] Strip prefix for display (UI layer)

---

### 4. SESSION STATE EVENTS (P1 - AUDIT TRAIL)

**Why Useful:** Audit trail, UI updates, cross-session coordination.

**OpenClaw Pattern:**
```typescript
recordSessionStateEvent(input: {
  type: "human_direct_message" | "session_compacted" | ...
  sessionKey: string
  agentId: string
  payload: any
}): SessionStateEventRecord
```

**Implementation Checklist:**
- [ ] Create `SessionEvent` model (SQLite table)
- [ ] Event types: message, compaction, goal_changed, created, terminated
- [ ] Best-effort append (never fails originating action)
- [ ] Retention: 30 days or 50k rows per session
- [ ] Use for: UI updates, audit log, debugging

---

### 5. TURN CORRELATION (P1 - NICE-TO-HAVE)

**Why Useful:** Fast-path reply capture without second agent run.

**OpenClaw Pattern:**
```typescript
// Before sending to LLM:
const handle = registerPendingConversationTurn({
  agentId, conversationRef, sessionId
})

// After outbound:
handle.setOutboundMessageId(messageId)
handle.markReady()

// On inbound reply:
const claim = await claimPendingConversationTurnReply({
  replyToId: messageId
})
if (claim) {
  // Fast path: skip agent run, just persist
  claim.complete()
}
```

**Implementation:** In-memory registry, 60s timeout, optional for Phase 2+.

---

## IMPLEMENTATION PRIORITY

| Pattern | Priority | Effort | Impact | Phase |
|---------|----------|--------|--------|-------|
| Work Admission Queue | 🔴 P0 | 24h | Prevents corruption | Phase 1 |
| Idempotent Transcript | 🔴 P0 | 12h | Prevents duplicates | Phase 1 |
| Input Provenance | 🔴 P0 | 8h | Security | Phase 1 |
| Session State Events | 🟡 P1 | 16h | Audit trail | Phase 2 |
| Turn Correlation | 🟡 P1 | 12h | Fast-path replies | Phase 2 |

**Total P0 Effort:** 44h (1 week for 1 engineer)

---

## REVISED PHASE 1 CRITICAL PATH

**Original Phase 1:** 118h (Context Engine 64h + Model Fallback 34h + Session Admission 20h)

**NEW Phase 1 with Sessions findings:** 162h
- Context Engine Migration: 64h
- Model Fallback Integration: 34h
- **Session Admission Queue: 24h** (NEW, up from 20h)
- **Idempotent Transcript: 12h** (NEW)
- **Input Provenance: 8h** (NEW)

**Timeline:** 4 weeks for 2 engineers (was 3 weeks)

---

## RISK IF NOT IMPLEMENTED

| Risk | Without Session Admission | With Session Admission |
|------|---------------------------|------------------------|
| Concurrent requests | ❌ Corrupt transcript | ✅ Queued, serial |
| Race conditions | ❌ Lost messages | ✅ Prevented |
| Tool execution | ❌ Interleaved | ✅ Isolated |
| Retry safety | ❌ Duplicate messages | ✅ Idempotent |
| Cross-session | ❌ Prompt injection | ✅ Provenance tracked |

**Bottom Line:** Without these 3 patterns, Arunaki **CANNOT** be autonomous for business use.

---

## ACCEPTANCE CRITERIA

**Phase 1 DONE when:**
- ✅ No concurrent runs on same session (queue enforced)
- ✅ No duplicate messages on retry (idempotency keys)
- ✅ All messages have provenance (security)
- ✅ Zero race condition test failures
- ✅ 90%+ test coverage on admission queue

---

## NEXT ACTIONS

1. Update `ROADMAP-Implementation.md` with revised Phase 1 (162h)
2. Create `SessionAdmissionService` class
3. Add `idempotencyKey` to Message model
4. Add `provenance` JSON field to Message model
5. Integrate into `AgentRunnerService`
6. Write 15+ test cases (concurrent requests, timeouts, cancellation)

---

**Status:** 🔴 CRITICAL — Phase 1 must include these patterns or Arunaki is NOT production-ready.
