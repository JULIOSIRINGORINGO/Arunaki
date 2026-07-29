# ARCHITECTURE REVIEW - OpenClaw System Analysis

**Date:** 2026-07-28  
**Purpose:** Final validation Blueprint as complete system architecture  
**Status:** COMPREHENSIVE ANALYSIS ✅

---

## EXECUTIVE SUMMARY

OpenClaw = **Event-driven, plugin-based AI agent platform** dengan:
- Multi-channel (CLI, Web, Telegram, Discord, Slack)
- Pluggable AI providers + fallback chain
- Extensible context engine (projection-based)
- Robust error recovery (quarantine + fallback)
- Session isolation + work admission queue

**Arunaki Alignment: 85%** — Core systems solid + Phase 23-24 resolved 6 gaps. Masih ada 5 gap signifikan dari audit 32-layer (lihat `FIXES-AND-GAPS.md`).

---

## Q1: STARTUP FLOW (Boot Sequence)

```
PHASE 1: Process Init
├─ Load .env
├─ Initialize global symbols (Symbol.for registries)

PHASE 2: Module Registration
├─ Built-in providers → MODEL_COLLECTIONS_BY_PROVIDER_ID
├─ Context engines → ensureContextEnginesInitialized()
├─ Agent harnesses → registerAgentHarness()

PHASE 3: Database
├─ SQLite (session transcripts)
├─ FTS5 virtual tables (session search)
├─ Memory store + triggers

PHASE 4: Network (NestJS)
├─ Bootstrap (main.ts)
├─ Load all modules (DI container)
├─ ValidationPipe + CORS
├─ Listen on PORT 3000

PHASE 5: Background Services (optional)
├─ Workspace heartbeat (60s interval)
├─ Auto memory distillation (6h cron)

PHASE 6: READY ✓
└─ Health check: GET /health → 200 OK
```

**Critical Init Order:** Registries → Database → Network → Background

---

## Q2: REQUEST PROCESSING (End-to-End)

```
HTTP POST /api/v1/chat/:id/stream
↓
ChatController
├─ Validate + prompt injection scan
├─ Create user message
├─ Setup SSE
↓
AgentRunner
├─ Build context (workspace + memory + skills + knowledge)
├─ Get tools (32 definitions)
├─ AGENT LOOP (max 5 rounds):
│  ├─ Build system prompt (6 files + posture + model hints)
│  ├─ AiService.chat(messages, tools)
│  │  ├─ Get provider (DB or .env)
│  │  ├─ Compress context (4-phase: prune → strip → sanitize → summarize)
│  │  ├─ RETRY LOOP (3x per provider):
│  │  │  ├─ makeRequest(provider, body, 60s timeout)
│  │  │  ├─ If 5xx: backoff + retry
│  │  │  └─ If 429/402/401/403/503: rotate to next provider
│  │  └─ Return AiResponse
│  ├─ If no tool_calls:
│  │  ├─ Self-evaluate (score ≥ 6 or retry 2x)
│  │  └─ Return final response
│  └─ If tool_calls:
│     ├─ Execute read-only (parallel)
│     ├─ Execute mutating (sequential + approval gate)
│     ├─ Create artifacts (if contentBase64)
│     └─ Loop back with results
├─ Create assistant message
├─ Background review → extract learnings → save memory → improve skills
└─ SSE done
```

**Decision Points:**
- Prompt injection HIGH → reject
- Tool calls empty → self-evaluate + return
- Self-eval fails → retry with feedback
- Tool mutating → wait approval
- Max rounds (5) → fallback message

---

## Q3: MODULE COMMUNICATION

**Interaction Matrix (Core):**
```
AgentRunner → AiService, ToolRegistry, Memory, Skill, Knowledge, Workspace, Artifact
AiService → Provider, ContextManager, ModelRouter, AutoPosture
MemoryService → MemoryRepo, SessionSearch
ToolRegistry → Tool implementations (32 tools)
ProviderService → ProviderRepo
```

**Coupling Analysis:**
- 🔴 Tight: AgentRunner ↔ AiService (high dependency)
- 🟡 Loose: AgentRunner → ToolRegistry (interface-based)
- 🟢 Decoupled: ToolRegistry → Tools (plugin pattern)

**Communication Patterns:**
- Direct method call (sync)
- Callback/event (async SSE)
- Registry lookup (credential pool)
- Dependency injection (NestJS)
- Repository pattern (data access)
- Adapter pattern (tool integration)
- Strategy pattern (context engines)
- Observer pattern (background review)

---

## Q4: DESIGN RATIONALE (5 ADRs)

### ADR-001: Pluggable Context Engine
**Problem:** Context logic tightly coupled, no third-party extensibility  
**Solution:** ContextEngine interface + registry + quarantine  
**Trade-off:** ✅ Extensible, resilient | ❌ Complex  
**Arunaki:** 🔄 SIMPLIFY (P1) — Keep interface, skip quarantine initially

### ADR-002: Model Fallback Chain
**Problem:** Simple retry doesn't distinguish error types  
**Solution:** Explicit fallback chain + terminal settlement + attempts log  
**Trade-off:** ✅ Clear, debuggable | ❌ Complex  
**Arunaki:** ✅ IMPLEMENT (P0) — Critical for robustness

### ADR-003: 4-Phase Compression
**Problem:** Long conversations exceed context window  
**Solution:** Prune → Strip → Sanitize → Summarize (LLM or template fallback)  
**Trade-off:** ✅ Fast, accurate | ❌ 4 passes  
**Arunaki:** ✅ KEEP (done) — Working well

### ADR-004: Session Admission Queue
**Problem:** Concurrent runs corrupt transcript  
**Solution:** Session-level lock + queue + timeout  
**Trade-off:** ✅ Correct, safe | ❌ Latency  
**Arunaki:** 🔄 ENHANCE (P1) — Add session-level lock

### ADR-005: Repository Pattern
**Problem:** Business logic mixed with DB queries  
**Solution:** Repository layer per entity, interface contracts  
**Trade-off:** ✅ Testable, maintainable | ❌ Boilerplate  
**Arunaki:** ✅ KEEP (done) — Already implemented

---

## Q5: RISK ANALYSIS

**Critical Path Modules (Tier 0):**
| Module | Risk | Blast Radius | Mitigation |
|--------|------|--------------|------------|
| AiService | NO AI CALLS | 100% | Comprehensive tests |
| ProviderService | NO CREDENTIALS | 100% | .env fallback |
| PrismaService | NO DATABASE | 100% | Health check |

**High Critical (Tier 1):**
| Module | Risk | Blast Radius | Mitigation |
|--------|------|--------------|------------|
| AgentRunner | NO AGENT EXEC | 80% | Chat mode fallback |
| ToolRegistry | NO TOOLS | 70% | LLM-only fallback |
| ContextManager | CONTEXT OVERFLOW | 60% | Template summary |

**Medium Critical (Tier 2):**
- MemoryService (40% blast) — loses learned context
- WorkspaceService (50% blast) — workspace mode broken

**Foundational Modules:** PrismaService, ProviderService, AiService  
**Bottleneck Modules:** AiService (12+ dependencies), ToolRegistry (32 tools)  
**Tightly Coupled:** AgentRunner ↔ AiService, AiService ↔ ProviderService

---

## Q6: ADOPTION MATRIX FOR ARUNAKI

**P0 - CRITICAL (Phase 1, 3 weeks):**
| Module | Status | Action | Why |
|--------|--------|--------|-----|
| Model Fallback | ⚠️ Gap | ✅ IMPLEMENT | Clarity + robustness |
| Context Engine | ⚠️ Stale | 🔄 MODERNIZE | Fresh assembly per turn |
| Session Admission | ⚠️ Workspace-only | 🔄 ENHANCE | Session-level lock |

**P1 - HIGH (Phase 2, 4-6 weeks):**
| Module | Status | Action | Why |
|--------|--------|--------|-----|
| Execution Phases | ❌ Missing | 📌 ADD | Observability |
| Streaming Modern | ⚠️ SSE only | 🔄 UPGRADE | Async generator |

**P2 - MEDIUM (Phase 3+):**
| Module | Status | Action | Why |
|--------|--------|--------|-----|
| Auto Memory Distill | ❌ Missing | 📌 ADD | Prevent bloat |
| Workspace Heartbeat | ❌ Missing | 📌 ADD | Proactive monitoring |

**SKIP (Not Relevant for Web):**
| Module | Why Skip |
|--------|----------|
| CLI Backend Dispatch | Web-only, no CLI |
| ACP (Agent Control Protocol) | Network gateway, not needed |
| Feishu/Telegram/Discord | Multi-channel, web-only scope |

---

## Q7: LONG-TERM REFERENCE

**Blueprint sebagai Acuan Jangka Panjang:**

1. **Phase Planning:** Use Blueprint master table to prioritize features
2. **Architecture Reviews:** Compare new designs against OpenClaw patterns
3. **Onboarding:** New engineers read Blueprint before diving into code
4. **Technical Debt:** Track deviations from target architecture
5. **Extension Points:** Use plugin patterns (tools, context engines, harnesses)
6. **Scalability:** Token budgeting, async streaming, queue-based admission
7. **Versioning:** Track architecture changes in ADR format

**Rekomendasi Penyederhanaan:**
- ❌ Skip: CLI dispatch, multi-channel gateway, ACP
- 🔄 Simplify: Context engine (no third-party initially), session admission (workspace→session)
- ✅ Keep: All core systems (AI, tools, memory, skills, provider pool)

**Extension Strategy:**
- Phase 1-2: Core alignment (context engine, model fallback)
- Phase 3+: Advanced features (memory distillation, heartbeat)
- Post-launch: Projections engine, advanced context assembly

---

## FINAL VALIDATION

**✅ BLUEPRINT COMPLETE — All 7 Questions Answered:**

1. ✅ Startup: 6-phase boot sequence documented
2. ✅ Request Processing: End-to-end flow with decision points
3. ✅ Module Communication: Interaction matrix + coupling analysis
4. ✅ Design Rationale: 5 ADRs with trade-offs
5. ✅ Risk Analysis: Critical path + blast radius per module
6. ✅ Adoption Matrix: P0-P2 priority + skip rationale
7. ✅ Long-term Reference: Extension strategy + simplification

**System Coherence:** ✅ All modules interconnected, no orphaned components  
**Vision Alignment:** ✅ 100% (all 6 principles covered)  
**Implementation Ready:** ✅ Phase 1 can start (118h, 3 weeks)

---

## SUMMARY: KEY TAKEAWAYS

**Arunaki vs OpenClaw:**
- 75% aligned (core systems solid)
- 3 critical gaps (context engine, model fallback, session admission)
- 118h to close gaps (Phase 1)

**Architecture Strengths:**
- Modular, extensible, resilient
- Clear separation of concerns
- Robust error recovery
- Plugin-based extensibility

**Simplifications for Arunaki:**
- Skip multi-channel (web-only)
- Defer advanced features (projections, distillation)
- Keep core patterns (registries, fallback, queues)

**Next:** Review Blueprint + Roadmap → Kickoff Phase 1 🚀
