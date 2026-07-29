# IMPLEMENTATION ROADMAP - Arunaki (REVISED)

**Date:** 2026-07-28 (Updated after Sessions analysis)
**Last Revised:** 2026-07-29 — Comprehensive 32-layer audit selesai. Lihat `FIXES-AND-GAPS.md` untuk gap tracker terkini.
**Status:** Phase 23-24 ✅, fokus ke Blueprint P0 gaps
**Vision Alignment:** ✅ All 6 principles covered

---

## EXECUTIVE SUMMARY (REVISED 2026-07-29)

**Progress:** Phase 23-24 menyelesaikan 6 gap besar — Context Engine (proyeksi + refresh), Dual-loop agent, Execution phase, Streaming modernisasi, SelfHealing & PromptInjection integration.

Arunaki architecture sekarang **~85% aligned** dengan OpenClaw patterns. Core systems (AI, tools, memory, skills, context engine, agent loop) sudah solid.

**Gap Tersisa (dari audit 32-layer):**

| Prioritas | Gap | Layer | Status |
|-----------|-----|-------|--------|
| 🔴 P0 | Input Provenance | 9 | ❌ Belum ada |
| 🔴 P0 | User Turn Transcript | 8 | ❌ Belum ada |
| 🔴 P0 | Session Admission Duplikasi | 6 | ⚠️ 2 file beda API |
| 🟡 P1 | Session State Events | 7 | ❌ Belum ada |
| 🟡 P1 | Harness Registry | 5 | ❌ Belum ada |
| 🟢 P2 | runWithModelFallback | 2 | 🔄 Inline di AiService |
| 🟢 P2 | Heartbeat wiring | 29 | 🔄 No-op |
| 🟢 P3 | Auto Memory cron | 25 | 🔄 Reaktif saja |
| 🟢 P3 | LLM Stream modular | 9d | 🔄 Inline |

Detail lengkap → `FIXES-AND-GAPS.md`

---

## REVISED PHASE 1: CRITICAL PATH (162h Total, 4 weeks)

### 1.1: Context Engine Migration (64h) — UNCHANGED
### 1.2: Model Fallback Integration (34h) — UNCHANGED

### 1.3: Session Admission Queue (24h) 🔴 NEW CRITICAL

**Why Critical:** Prevents transcript corruption from concurrent requests.

**Tasks:**
```
[ ] 1.3.1: Create SessionAdmissionService (8h)
[ ] 1.3.2: Implement SessionAdmissionLease (6h)
[ ] 1.3.3: Integrate into AgentRunnerService (6h)
[ ] 1.3.4: Tests for concurrent scenarios (4h)
```

**Verification:**
- ✅ No concurrent runs on same session
- ✅ Different sessions run in parallel
- ✅ Timeout after 15s
- ✅ Cancellation via AbortSignal

---

### 1.4: Idempotent Transcript Recording (12h) 🔴 NEW CRITICAL

**Why Critical:** Prevents duplicate messages on retry.

**Tasks:**
```
[ ] 1.4.1: Add idempotencyKey to Message model
    - Migration: add column (nullable)
    - Index: unique on idempotencyKey
    - Estimate: 2h

[ ] 1.4.2: Generate idempotency keys
    - Pattern: `run:${runId}` or `turn:${chatId}:${timestamp}`
    - Add to MessageService.createMessage()
    - Estimate: 3h

[ ] 1.4.3: Check before insert
    - findFirst({ idempotencyKey })
    - If exists: return existing, skip insert
    - If null: insert new
    - Estimate: 4h

[ ] 1.4.4: Tests
    - Retry creates no duplicates
    - Different runs create new messages
    - Null key still works (backwards compat)
    - Estimate: 3h
```

**Verification:**
- ✅ Retry same runId → no duplicate
- ✅ Different runId → new message
- ✅ Existing messages (null key) unaffected

---

### 1.5: Input Provenance Tracking (8h) 🔴 NEW CRITICAL

**Why Critical:** Security — prevents prompt injection via cross-session routing.

**Tasks:**
```
[ ] 1.5.1: Add provenance to Message model
    - Migration: add JSON column (nullable)
    - Type: { kind, sourceSessionId?, sourceTool?, isUser? }
    - Estimate: 2h

[ ] 1.5.2: Track provenance on creation
    - MessageService.createMessage() sets provenance
    - Default: { kind: "external_user" }
    - For system messages: { kind: "internal_system" }
    - Estimate: 3h

[ ] 1.5.3: Annotate inter-session messages
    - Prefix: "[Inter-session message] ..."
    - Strip prefix for UI display
    - Estimate: 2h

[ ] 1.5.4: Tests
    - User messages have provenance
    - System messages tracked
    - Inter-session messages annotated
    - Estimate: 1h
```

**Verification:**
- ✅ All new messages have provenance
- ✅ Inter-session messages annotated
- ✅ UI strips prefix correctly

---

## PHASE 1 SUMMARY (REVISED)

| Task | Effort | Priority | Status |
|------|--------|----------|--------|
| Context Engine | 64h | P0 | Planned |
| Model Fallback | 34h | P0 | Planned |
| Session Admission | 24h | P0 | NEW |
| Idempotent Transcript | 12h | P0 | NEW |
| Input Provenance | 8h | P0 | NEW |
| **TOTAL P0** | **142h** | — | **3.5 weeks** |

**Optional P1 (defer to Phase 2):**
- Session State Events (16h)
- Turn Correlation (12h)

**Total with P1:** 162h (4 weeks for 2 engineers)

---

## CRITICAL SUCCESS FACTORS (UPDATED)

**Phase 1 DONE when:**
- ✅ Context assembly fresh per turn
- ✅ Model fallback explicit with attempts log
- ✅ No concurrent runs on same session (queue enforced)
- ✅ No duplicate messages on retry (idempotency keys)
- ✅ All messages have provenance (security)
- ✅ Zero race condition test failures
- ✅ 90%+ test coverage on new components

---

## RISK IF SESSIONS PATTERNS NOT IMPLEMENTED

| Risk | Without | With |
|------|---------|------|
| Concurrent requests | ❌ Corrupt transcript | ✅ Queued, serial |
| Retry safety | ❌ Duplicate messages | ✅ Idempotent |
| Cross-session routing | ❌ Prompt injection | ✅ Provenance tracked |
| Race conditions | ❌ Lost messages | ✅ Prevented |
| Tool execution | ❌ Interleaved | ✅ Isolated |

**Bottom Line:** Without Session Admission + Idempotent Transcript + Input Provenance, Arunaki **CANNOT** be production-ready for business autonomy.

---

## NEXT ACTIONS (UPDATED)

1. ✅ Review updated ROADMAP
2. ✅ Review SESSIONS-LAYER-CRITICAL-FINDINGS.md
3. Create `SessionAdmissionService` (@Injectable)
4. Add `idempotencyKey` to Message model (migration)
5. Add `provenance` JSON to Message model (migration)
6. Run Prisma migration: `npx prisma migrate dev`
7. Integrate into `AgentRunnerService.runAgentStream()`
8. Write 20+ tests (admission queue, idempotency, provenance)
9. Begin Phase 1 Sprint (Week 1-4)

---

**Status:** 🔴 CRITICAL — Phase 1 REVISED with 3 new mandatory tasks. Timeline extended from 3 weeks → 4 weeks.

**See also:** `docs/SESSIONS-LAYER-CRITICAL-FINDINGS.md` for detailed Sessions analysis.
