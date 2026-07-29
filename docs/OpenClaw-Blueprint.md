# OpenClaw-Blueprint.md - Exhaustive Architecture Analysis
## Generated: 2026-07-28

# MASTER TABLE: OpenClaw Core Layers for Arunaki

| No | Layer | Scope | File | Fungsi | Dependency | Status | Arunaki |
|----|-------|-------|------|--------|-----------|--------|---------|
| 1 | Agent Command | CLI/Ingress | agent-command.ts | Entrypoint orchestration | RuntimeEnv, SessionStore | ✅ | 🔄 Web only |
| 2 | Embedded Agent Entry | Fallback chain | run-entry.ts | Model fallback + terminal settlement | ModelFallback, Harness | ✅ | ✅ Core |
| 3 | CLI Backend | CLI routing | cli-backend-dispatch.ts | CLI dispatch + transcript | CliAgent, MCP | ❌ | ❌ CLI only |
| 4 | Execution Phase | Lifecycle | execution-phase.ts | 14 phase tracking | Phase tracking | 📌 | 📌 Optional |
| 5 | Harness Registry | Plugin | harness/registry.ts | Agent harness plugin system | Plugin API | ✅ | 🔄 Simplified |
| 6 | Session Admission Queue | Concurrency | session-lifecycle-admission.ts | Queue-based work admission, lease pattern | AsyncLocalStorage, Handoff tokens | ✅ | ✅ P0 CRITICAL |
| 7 | Session State Events | Signal Log | session-state-events.ts | Durable event log, version heads, watch cursors | SQLite event log, CAS updates | ✅ | 🔄 P1 Audit trail |
| 8 | User Turn Transcript | Persistence | user-turn-transcript.ts | Idempotent transcript recording, late media | Transcript store, Provenance | ✅ | ✅ P0 CRITICAL |
| 9 | Input Provenance | Security | input-provenance.ts | Track message origin, inter-session safety | Provenance metadata | ✅ | ✅ P0 Security |
| 10 | Upstream Monitor | Polling | session-upstream-monitor.ts | External source polling (Slack, etc.) | CAS markers, Source identity | ❌ | ❌ Multi-channel only |
| 11 | Turn Correlation | Fast-path | conversation-turns.ts | In-memory turn correlation, fast replies | Pending turn registry | 📌 | 📌 P1 Nice-to-have |
| 12 | Session Key Normalize | Multi-channel | session-key-utils.ts | Case-preserving normalization (Signal, Matrix) | LRU cache, Peer registry | ❌ | ❌ Multi-channel only |
| 8 | Context Engine Reg | Registry | context-engine/registry.ts | Pluggable context engines | Registry, Quarantine | ✅ | 🔄 Target |
| 9 | LLM Stream | Streaming | llm/stream.ts | Async token streaming | Event stream, Provider | ✅ | ✅ Core |
| 10 | Provider Registry | Catalog | llm/models.ts | Model collection + metadata | Provider collection | ✅ | ✅ Core |
| 11 | Gateway Handler | Provider | llm/providers/gateway.ts | Provider abstraction layer | AgentModel, Request | ✅ | ✅ Core |
| 12 | AI Service | LLM orchestration | ai/ai.service.ts | Provider pool + context prep | ProviderService, ContextMgr | ✅ | ✅ Skip |
| 13 | Context Manager | Compression | ai/context-manager.ts | 4-phase pipeline | Message, Token | ✅ | ✅ Skip |
| 14 | Model Router | Steering | ai/model-router.service.ts | Model family detection | Model registry | ✅ | ✅ Skip |
| 15 | Auto Posture | Intent | ai/auto-posture-detector.service.ts | Conversation intent detect | Posture registry | ✅ | ✅ Skip |
| 16 | Self Evaluation | Quality | ai/self-evaluation.service.ts | Output quality gate | Quality scoring | ✅ | ✅ Skip |
| 17 | Self Healing | Recovery | ai/self-healing.service.ts | Tool error recovery | Recovery strategies | ✅ | ✅ Skip |
| 18 | Prompt Injection | Security | ai/prompt-injection-detector.service.ts | Input security scan | Pattern registry | ✅ | ✅ Skip |
| 19 | Tool Registry | Management | tools/tool-registry.ts | Tool CRUD + execution | Tool interface | ✅ | ✅ Skip |
| 20 | Tool Adapter | Pattern | tools/tool-adapter.ts | Adapter wrapper | Tool interface | ✅ | ✅ Skip |
| 21 | Memory Service | CRUD | memory/memory.service.ts | Memory storage + injection | Memory repo | ✅ | ✅ Skip |
| 22 | Session Search | FTS5 | memory/session-search.service.ts | Chat history search | FTS5 virtual table | ✅ | ✅ Skip |
| 23 | Background Review | Learning | memory/background-review.service.ts | Auto-learn from turns | Pattern matching | ✅ | ✅ Skip |
| 24 | Smart Recall | Context | memory/smart-recall.service.ts | Prefetch relevant context | Keyword filtering | ✅ | ✅ Skip |
| 25 | Auto Memory | Distillation | memory/auto-memory.service.ts | LLM memory compression | LLM summarization | ✅ | 📌 Optional |
| 26 | Provider Service | Creds | provider/provider.service.ts | Credential pool management | Provider repo | ✅ | ✅ Skip |
| 27 | Skills System | Workflows | skills/skill.service.ts | Domain-scoped reusable skills | Skill repo | ✅ | ✅ Skip |
| 28 | Domain Registry | Config | domain/domain.registry.service.ts | Business domain configs | JSON configs | ✅ | ✅ Skip |
| 29 | Workspace Svc | Lifecycle | workspace/workspace.service.ts | Workspace CRUD + scanning | Storage, File services | ✅ | ✅ Skip |
| 30 | Chat History | Persistence | chat/chat-history.service.ts | Chat session storage | Chat repo | ✅ | ✅ Skip |
| 31 | Agent Runner | Execution | chat/agent-runner.service.ts | Multi-round agent loop | Tool registry | ✅ | ✅ Skip |
| 32 | Artifact Service | Output | artifact/artifact.service.ts | Generated documents | Artifact repo | ✅ | ✅ Skip |

---

# LAYER DETAILS (Core Path Only)

## LAYER 1: Embedded Agent Run Entry
**File:** src/agents/embedded-agent-runner/run-entry.ts
**Purpose:** Execute model fallback chain; handles terminal settlement, behavior classification, session override.

**Exported:**
- Type: EmbeddedAgentRunEntryTerminal
- Type: EmbeddedAgentRunEntryResult<T>
- Function: runEmbeddedAgentEntry<T>(params)

**Key Workflows:**
1. runEmbeddedAgentEntry(params) → runWithModelFallback()
2. For each (provider, model) candidate:
   - ensureSelectedAgentHarnessPlugin() → setup harness
   - params.runCandidate(provider, model) → execute
   - classifyResult() → decision (continue/fallback/exhaust)
3. buildTerminal() → terminal state
4. Return settled result with attempts log

**Design:** Chain of Responsibility (fallback), Strategy (behavior settlement)
**Relevance:** ✅ IMPLEMENT (core fallback chain)

---

## LAYER 2: Session Lifecycle & Work Admission (EXHAUSTIVE FROM SOURCE)
**Files:** src/sessions/ (20+ files analyzed from OpenClaw GitHub)
**Purpose:** Session isolation, concurrent run prevention, transcript persistence, upstream monitoring.

### 2.1 Work Admission Queue (session-lifecycle-admission.ts)
**Critical Pattern:** Queue-based admission prevents concurrent runs on same session

**Exported Functions:**
```typescript
beginSessionWorkAdmission(params: {
  scope: string,              // "agent:<id>" namespace
  identities: Iterable<string>, // session keys/IDs
  assertAllowed?: () => void,   // Pre-admission validation
  signal?: AbortSignal          // Cancellation support
}): Promise<SessionWorkAdmissionLease>

SessionWorkAdmissionLease {
  createHandoff(): string       // Cross-RPC handoff token
  release(): Promise<void>      // Release lock
  run<T>(fn: () => Promise<T>): Promise<T> // Execute under lease
}
```

**Admission Flow:**
```
1. Call beginSessionWorkAdmission() with session identities
2. runExclusiveSessionLifecycle() acquires locks:
   - Global singleton: SESSION_LIFECYCLE_ADMISSION_STATE
   - Per-identity sets: ACTIVE_SESSION_WORK_ADMISSIONS
   - AsyncLocalStorage tracks current context
3. If competing admission active:
   - Queue request with timeout (15s default)
   - Wait for release signal
4. assertAllowed() validates (e.g., session not archived)
5. Return lease with handoff capability
6. lease.release() → dequeue next waiter
```

**Handoff Tokens (session-work-admission-handoff.ts):**
- Cross-RPC boundary admission transfer
- Single-use UUID tokens
- Prevents duplicate admission for same logical work
- Use case: Gateway RPC → channel dispatch

**Key Properties:**
- ✅ Prevents race conditions on transcript append
- ✅ Serializes tool execution per session
- ✅ Supports cancellation via AbortSignal
- ✅ 15s timeout prevents deadlock
- ✅ Handoff tokens enable cross-process coordination

### 2.2 Session State Events (session-state-events.ts)
**Critical Pattern:** Durable signal log for session state changes

**Exported Functions:**
```typescript
recordSessionStateEvent(input: SessionStateEventInput): SessionStateEventRecord
  - Types: human_direct_message, session_compacted, session_goal_changed, 
           session_created, subagent_spawned, subagent_terminal_state
  - Best-effort: never fails originating action
  - Appends to SQLite event log (session_state_events table)

getSessionStateVersion(sessionKey, agentId): number
  - Durable version head per session
  - Used for optimistic concurrency control

listSessionStateEventsSince(sessionKey, agentId, afterSequence, limit?): Events
  - Paginated event retrieval
  - Supports history gap detection
```

**Signal Log Architecture:**
- Per-session durable event log (SQLite)
- Version heads track latest sequence
- Watch cursors track watcher progress
- Retention: 30 days, 50k rows max per session
- Use case: Cross-session coordination, UI updates, audit trail

### 2.3 User Turn Transcript (user-turn-transcript.ts)
**Critical Pattern:** Idempotent transcript recording with late media detection

**Exported Functions:**
```typescript
createUserTurnTranscriptRecorder(params): UserTurnTranscriptRecorder {
  markSentToProvider()           // Note LLM boundary crossing
  markRuntimePersisted()         // Parallel persistence
  persistApproved()              // Commit to transcript
}

buildPersistedUserTurnMessage(params): PersistedUserTurnMessage
  - Normalizes text, media, input provenance
  - Idempotency key: runId-based deduplication
```

**Persistence Modes:**
- "inline": Idempotent append with scan
- "none": Skip persistence
- Runtime persistence: Parallel to approved persistence

**Late Media Detection:**
- If media resolved after LLM send → creates 2nd turn
- Prevents context mismatch between user intent and LLM input

### 2.4 Input Provenance (input-provenance.ts)
**Critical Pattern:** Track message origin for security

**Provenance Kinds:**
```typescript
InputProvenance {
  kind: "external_user" | "inter_session" | "internal_system"
  sourceSessionId?: string
  sourceTool?: string
  isUser?: boolean
}
```

**Inter-Session Safety:**
- Prefix: "[Inter-session message] sourceSession=... isUser=false"
- Explanation text injected for transparency
- Prevents prompt injection via cross-session routing
- Strip prefix for display

**Use Case:** Subagent completion reports, agent-mediated handoffs

### 2.5 Session Upstream Monitor (session-upstream-monitor.ts)
**Critical Pattern:** Polling monitor for external source changes

**Monitor Loop:**
- Interval: 60s
- Checks upstream activity (e.g., Slack thread updates)
- Records human_direct_message events
- Missing upstream detection (3 consecutive ticks → delete link)

**Source Identity:**
- Hash(hostId, threadId, upstreamRef) → dedupe key
- CAS marker updates prevent stale scans
- Continue/restart can rebase to new source

### 2.6 Conversation Turn Correlation (conversation-turns.ts)
**Critical Pattern:** In-memory turn correlation for fast-path replies

**Flow:**
```
1. registerPendingConversationTurn() → in-memory waiter
2. Outbound message sent → setOutboundMessageId(messageId)
3. Inbound reply arrives → claimPendingConversationTurnReply()
   - Match by: agentId, conversationRef, replyToId
   - Thread promotion: allow parent → thread transition
   - Claim (once): pending.claimed = true
4. Transcript persistence → claim.complete()
5. Timeout/cancel → ordinary dispatch
```

**Use Case:** Fast-path reply capture without second agent run

### 2.7 Session Key Normalization (session-key-utils.ts)
**Critical Pattern:** Case-preserving normalization for multi-channel

**Case-Preserving Peers:**
- Signal: preserve single colon-free segment (group IDs)
- Matrix: preserve entire tail after prefix (room IDs)
- LRU cache: 2048 entries, 4KB max per key

**Key Formats:**
```
agent:<agentId>:<rest>
<channel>:<peerKind>:<peerId>
<channel>:<accountId>:<dm|direct>:<peerId>
Threaded: ....:thread:<eventId>
```

### Key Takeaways for Arunaki

**MUST IMPLEMENT (P0):**
1. ✅ Work admission queue (beginSessionWorkAdmission, lease pattern)
2. ✅ Session-level locking (prevent concurrent runs)
3. ✅ Idempotent transcript recording (runId-based dedup)
4. ✅ Input provenance tracking (security)

**SHOULD IMPLEMENT (P1):**
5. Session state events (audit trail, UI updates)
6. Turn correlation (fast-path replies)

**CAN SKIP (Not relevant for web-only):**
7. ❌ Upstream monitoring (multi-channel polling)
8. ❌ Case-preserving normalization (Signal/Matrix specific)
9. ❌ Handoff tokens (cross-RPC, not needed for web)

**Design:** State Machine, Queue Pattern, Signal Log, Idempotent Append, CAS Updates
**Relevance:** ✅ IMPLEMENT (absolute core for business autonomy)

---

## LAYER 3: AI Service
**File:** apps/api/src/modules/ai/ai.service.ts
**Purpose:** Central LLM orchestration; provider pool, error classification, context prep, system prompt.

**Exported:**
- Class: AiService
- Method: async chat(messages, tools?)
- Method: getSystemPrompt(mode, context?)
- Method: countTokens(text)
- Method: limitInjection(content, label)

**Provider Pool Logic:**
`
FOR retry 0..2 (3 retries per provider):
  - makeRequest(provider, body)
  - If OK: return response
  - If 5xx: backoff + retry
  - If 429/402/401/403/503: break to rotation
FOR rotation 0..2 (3 provider switches):
  - getNextAvailable() → next provider
  - Enter retry loop again
All exhausted: throw error
`

**Error Classification:**
- 5xx (except 503) → RETRY (same provider, backoff)
- 429/402/401/403/503 → ROTATE (next provider, cooldown)
- Other → FATAL

**Design:** Strategy (provider rotation), Retry (exponential backoff)
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 4: Context Manager
**File:** apps/api/src/modules/ai/context-manager.ts
**Purpose:** 4-phase compression pipeline; prune → strip → sanitize → summarize.

**Phases:**
1. Prune tool results (keep last 3 unpruned, replace > 2000 chars with preview)
2. Strip images (keep last 2, replace old with placeholder)
3. Sanitize tool pairs (remove orphaned results, inject stubs for missing)
4. Token-aware tail protection + summary (LLM or template)

**Config:**
- contextLength: 128000
- threshold: 0.5 (compress at 50%)
- targetRatio: 0.2 (tail = 20% of threshold budget)
- toolPruneChars: 2000
- injectionMaxChars: 7000

**Design:** Pipeline (phases), Template Method
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 5: Memory System
**File:** apps/api/src/modules/memory/

### 5.1 Memory Service
**Purpose:** CRUD + duplicate prevention + importance scoring + context injection

**Methods:**
- findRelevant(domain?, workspaceId?, limit?) → frozen snapshot for injection
- getMemoryContext(domain?, workspaceId?, maxChars?) → formatted for system prompt
- remember(data) → save with duplicate check
- recordPreference/recordBusinessFact/recordCorrection/etc

**Memory Types:**
- preference (importance: 7)
- business_fact (importance: 8)
- correction (importance: 9, highest)
- interaction (importance: 5)
- workspace_history (importance: 6)
- distilled_* (LLM-distilled, importance: 1-10)

**Design:** Repository, Scoring
**Relevance:** ✅ SKIP (already implemented)

### 5.2 Session Search
**Purpose:** FTS5 full-text search across chat history

**Methods:**
- search(query, options?) → FTS5 MATCH with rank ordering
- getRelevantContext(query, workspaceId?, maxChars?) → formatted for injection

**Storage:** SQLite FTS5 virtual table + triggers (auto-sync on message insert/delete/update)

**Design:** FTS5 Index, Trigger-based sync
**Relevance:** ✅ SKIP (already implemented)

### 5.3 Background Review
**Purpose:** Auto-learn after turn; extract corrections, preferences, business facts

**Methods:**
- reviewAndLearn(messages, workspaceId?, domain?) → extract → save

**Patterns:** Bilingual (ID+EN) regex for: corrections, preferences, business facts

**Design:** Pattern matching, Auto-distillation
**Relevance:** ✅ SKIP (already implemented)

### 5.4 Smart Recall
**Purpose:** Prefetch relevant context before task; keyword extraction + memory search + session search

**Methods:**
- recall(goal, workspaceId?, domain?) → combined context (memory + sessions)

**Workflow:**
1. extractKeywords(goal) → tokenize, remove stopwords (128 words), top 5
2. searchMemory(keywords) → top 5 formatted
3. searchSessions(keywords) → top 3 formatted
4. Combine + char-limit (2000 max)

**Design:** Keyword filtering, Multi-source search
**Relevance:** ✅ SKIP (already implemented)

### 5.5 Auto Memory
**Purpose:** LLM-powered memory distillation; compress 50+ raw → 5-10 high-quality

**Methods:**
- checkAndDistill(workspaceId?, domain?) → CRON trigger
- distill(memories) → group by type → LLM summarize → store distilled

**Thresholds:**
- DISTILLATION_THRESHOLD: 50 memories
- MAX_BATCH_SIZE: 100
- Max output: 10 distilled per group

**Design:** LLM summarization, Grouping, Batch processing
**Relevance:** 📌 OPTIONAL (nice-to-have, phase 2)

---

## LAYER 6: Tool System
**File:** apps/api/src/modules/tools/

**32 Tools (all via ToolAdapter):**
1. search_workspace
2. list_workspace_files
3. read_workspace_file
4. write_workspace_file (mutating, needs approval)
5. extract_structured_data
6. document_reader
7. data_query
8. image_ocr
9. doc_search
10. calculate
11. generate_export (xlsx, csv, pdf, docx, pptx)
12. save_knowledge
13. web_search
14. vision_ai
15. unit_converter
16. draft_communication
17. list_skills
18. view_skill
19. create_skill
20. search_skills
21. update_skill
22. delete_skill
23. list_memories
24. save_memory
25. search_memories
26. delete_memory
27. search_sessions
28-32. (additional domain-specific tools)

**Execution Modes:**
- Serial: single tool
- Parallel: Promise.all() multiple tools
- Gated/Approval: mutating tools require user approval

**Design:** Registry, Adapter, Factory
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 7: Agent Runner
**File:** apps/api/src/modules/chat/agent-runner.service.ts
**Purpose:** Multi-round agent execution; tool calling loop, artifact creation, SSE streaming.

**Methods:**
- runAgentSync(params) → max 5 rounds, returns {content, toolOutputs, artifacts}
- runAgentStream(params, onEvent) → SSE events per step

**Agent Loop (up to 5 rounds):**
1. Build system prompt
2. Get tool definitions
3. Call aiService.chat(messages, tools)
4. If no tool_calls: self-evaluate, return
5. If tool_calls:
   - Execute read-only tools (parallel)
   - Execute mutating tools (sequential with approval gate)
   - Add results to messages
   - Loop back to step 3

**Events:**
- thinking, tool_start, tool_done, text_delta, canvas_event, plan_created, plan_step, self_heal, done, error

**Design:** Loop, Event emitter, Artifact factory
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 8: Provider Management
**File:** apps/api/src/modules/provider/provider.service.ts
**Purpose:** AI credential pool; active selection, error classification, cooldown.

**Methods:**
- findActive() → active provider by priority
- getActiveConfig() → ProviderConfig DTO
- classifyError(statusCode, body) → (retry|rotate|fatal)
- getNextAvailable(currentProviderId?) → next provider not in cooldown
- setCooldown(id, seconds) → set cooldownUntil

**Cooldown Times:**
- 429: 60s
- 402: 300s
- 401/403: 600s
- 500/502: 30s
- 503: 60s

**Design:** Provider pool, Error classification, Cooldown manager
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 9: Skills System
**File:** apps/api/src/modules/skills/skill.service.ts
**Purpose:** Domain-scoped reusable workflows; CRUD, self-improvement, soft-delete.

**Methods:**
- findRelevant(domain?, workspaceId?) → domain + global + workspace-scoped
- getSkillsContext(maxChars?) → formatted for injection
- createSkill/updateSkill/deleteSkill (soft)
- improveSkillsFromLessons(lessons) → LLM auto-improve from learned facts

**Categories:** general, data-processing, reporting, integration

**Design:** Repository, Domain-aware filtering, Soft-delete, Self-improvement
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 10: Domain Registry
**File:** apps/api/src/modules/domain/domain.registry.service.ts
**Purpose:** Runtime domain config loading (15 JSON files); units, templates, SKUs.

**Domains:**
- generic, garment, restaurant, retail, apotek, bengkel, distributor, ekspedisi, kontraktor, laundry, manufaktur, minimarket, percetakan, petshop, salon

**Config Contains:**
- Units (length, mass, count, currency, custom)
- Business templates
- SKU definitions
- Domain-specific terminology

**Design:** Registry, JSON config loader
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 11: Workspace Service
**File:** apps/api/src/modules/workspace/workspace.service.ts
**Purpose:** Workspace lifecycle; CRUD, folder connection, file scanning, indexing.

**Methods:**
- create(data) → status='pending'
- connectFolder(id, folderPath) → scan + index files
- scanFolder() → recursive walk, extension filter
- updateStatus(id, status) → state transitions

**Supported Formats:**
- Text: .txt, .md, .csv, .json, .xml, .yaml, .html
- Office: .docx, .xlsx
- PDF: searchable + scanned (OCR)
- Images: .jpg, .png, .webp
- Archive: .zip, .rar

**Design:** CRUD, File scanner, Index builder
**Relevance:** ✅ SKIP (already implemented)

---

## LAYER 12: Chat History
**File:** apps/api/src/modules/chat/chat-history.service.ts
**Purpose:** Chat session persistence; CRUD, pinning, title auto-generation.

**Methods:**
- createChat(mode, workspaceId) → new chat session
- findAllChats/findByWorkspaceId/findById
- togglePin(id) → toggle pinned flag
- updateTitle(id, title) → auto or manual
- deleteChat(id)

**Design:** Repository, Lifecycle manager
**Relevance:** ✅ SKIP (already implemented)

---

# FIT-GAP ANALYSIS vs VISION & PRD

> **UPDATE 2026-07-29:** Audit komprehensif 32-layer selesai. Lihat `FIXES-AND-GAPS.md` untuk detail lengkap. Beberapa gap di bawah sudah diresolve di Phase 23-24.

## Vision Requirements
✅ **Goal First** — Workspace Agent understands goals, creates plans
  → Implemented: AutonomousPlannerService breaks goals into tasks

✅ **Workspace First** — Workspace is primary context
  → Implemented: WorkspaceService scans files, builds profile

✅ **Tool First** — Uses tools instead of LLM doing everything
  → Implemented: 32 tools via registry, tool-first prompts

✅ **Think Before Act** — Understand → Plan → Execute → Verify
  → Implemented: Autonomous planner + agent runner loop with self-evaluation

✅ **Safety First** — Work only within Workspace
  → Implemented: Storage service path traversal protection

✅ **Human in Control** — Approval for high-risk actions
  → Implemented: waitForApproval() for mutating tools

## PRD Requirements
✅ **Two Modes** — Chat (general) + Workspace (document-based)
  → Implemented: Chat mode (no workspace) + Workspace mode (tool-using)

✅ **Workspace Initialization** — 6 stages (~5-300s)
  → Implemented: connectFolder() → scanFolder() → file indexing

✅ **Planner** — Breaks goals into tasks
  → Implemented: AutonomousPlannerService

✅ **Tool System** — Data, processing, generation, output tools
  → Implemented: 32 tools across all categories

✅ **Artifact System** — Ready-to-use outputs
  → Implemented: ArtifactService with 10+ types

✅ **Chat History** — Searchable, contextual
  → Implemented: SessionSearchService (FTS5) + smart recall

✅ **Studio/Quick Actions** — Dynamic context-aware panel
  → Implemented: SkillService + domain-specific starter skills

## Gaps Identified

🔴 **CRITICAL GAPS (Blueprint Audit):**
1. **Input Provenance (Layer 9)** ❌ P0 SECURITY — Cross-session rawan prompt injection
   - Belum ada `input-provenance.ts`
   - Tidak ada provenance metadata (`external_user`, `inter_session`, `internal_system`)
   - Tidak ada inter-session safety prefixing
   - Fix: Implementasi full provenance tracking + safety prefix injection

2. **User Turn Transcript (Layer 8)** ❌ P0 IDEMPOTEN — Recording bisa duplikasi/korupsi
   - Belum ada `user-turn-transcript.ts`
   - Tidak ada idempotent key + runId deduplication
   - Tidak ada `markSentToProvider()` / `markRuntimePersisted()` / `persistApproved()`
   - Fix: Implementasi full transcript recorder + late media detection

🟡 **HIGH GAPS (Blueprint Audit):**
3. **Session Admission Duplikasi (Layer 6)** — 2 file beda API (`ai/` vs `chat/`)
   - `beginAdmission()` vs `acquireAdmission()` — incompatible
   - Tidak ada handoff token, cross-RPC handoff, AsyncLocalStorage tracking
   - Fix: Merge + standardisasi API

4. **Session State Events (Layer 7)** ❌ P1 AUDIT — Durable event log belum ada
   - Tidak ada signal log, version heads, watch cursors
   - Fix: SQLite event log + CAS version tracking

5. **Harness Registry (Layer 5)** ❌ P1 PLUGIN — Plugin system belum ada
   - Tidak ada `harness/` directory
   - Fix: Lightweight plugin registration mechanism

🟢 **MEDIUM GAPS (Blueprint Audit):**
6. **runWithModelFallback (Layer 2)** — Fallback logic inline di AiService.chat()
   - Tidak ada explicit model fallback chain
   - Tidak ada behavior classification, terminal state builder
   - Fix: Extract `runWithModelFallback()` factory function

7. **Workspace Heartbeat Tidak Jalan** — `registerWorkspace()` gak pernah dipanggil
   - WorkspaceHeartbeatService ada (255 lines) tapi jadi no-op
   - Fix: Panggil dari `WorkspaceService.connectFolder()`

8. **Auto Memory Distillation Hanya Reaktif** — Bukan cron, cuma jalan pas chatting
   - Fix: Tambah cron trigger ke CronService

9. **LLM Stream Inline** — Streaming di agent-runner.service.ts, bukan modul reusable
   - Fix: Extract AsyncGenerator modular

🐞 **LEGACY GAPS (dari versi sebelumnya — beberapa sudah diresolve):**
- ~~Context Assembly~~ ✅ DONE: ContextEngine registry + projection system + refresh per 5 rounds (Phase 24)
- ~~Model Fallback Clarity~~ 🟡 Partial: Provider rotation works, tapi belum explicit runWithModelFallback()
- ~~Execution Phases~~ ✅ DONE: Phase tracking dengan SSE events (Phase 24)
- ~~Session Admission Queue~~ 🟡 Partial: Ada tapi duplikasi (lihat gap #3 di atas)
- ~~Streaming Modernization~~ ✅ DONE: AsyncGenerator + `POST .../agent/stream/generator` (Phase 24)
- Auto memory distillation 🟡 Partial: Ada, reaktif (lihat gap #8 di atas)
7. Autonomous planner reflection loop (basic planner exists)
8. Workspace heartbeat monitoring (not wired)

---

# ROADMAP: IMPLEMENTATION PHASES

## Phase 1: CORE (Weeks 1-3)
✅ Already implemented:
- AI service (provider pool, error classification)
- Context manager (4-phase compression)
- Tool system (32 tools, registry, execution)
- Memory system (CRUD, search, recall, background review)
- Skills system (domain-scoped, soft-delete)
- Agent runner (multi-round loop, artifact creation)
- Workspace service (scanning, indexing)
- Chat history (persistence, search)
- Provider management (cooldown, rotation)

## Phase 2: MODERNIZATION (Weeks 4-6)
🔄 Refactor for OpenClaw alignment:
1. **Context Engine Migration** (Gap 1, CRITICAL)
   - Implement ContextEngine interface (registry.ts)
   - Create LegacyContextEngine wrapper for current 4-phase
   - Implement projection-based assembly (future target)
   - Add quarantine system for robustness
   - Status: 🔄 IMPLEMENT WITH MODIFICATION

2. **Model Fallback Integration** (Gap 2, CRITICAL)
   - Wire runWithModelFallback() into AiService.chat()
   - Explicit fallback chain per result classification
   - Terminal settlement integration
   - Status: ✅ IMPLEMENT

3. **Session Management Enhancement** (Gap 4, MEDIUM)
   - Full session-level admission lock (not just per-workspace)
   - Recovery checkpointing
   - Lifecycle generation tracking
   - Status: 🔄 IMPLEMENT WITH MODIFICATION (simplify for web)

4. **Execution Phase Tracking** (Gap 3, OPTIONAL)
   - Add 14-phase milestones
   - Status reporting for long-running tasks
   - Status: 📌 OPTIONAL

5. **Streaming Modernization** (Gap 5, NICE-TO-HAVE)
   - Async generator pattern for token-level streaming
   - Type-safe chunk types
   - Status: 📌 NICE-TO-HAVE

## Phase 3: OPTIMIZATION (Weeks 7-8)
📌 Optional enhancements:
1. Auto memory distillation (checkAndDistill cron job)
2. Autonomous planner reflection loop
3. Workspace heartbeat monitoring
4. Advanced context assembly with projections

---

# CRITICAL SUCCESS FACTORS

1. **Vision Compliance** — All features map to Vision's 6 principles
2. **Workspace Isolation** — No cross-workspace leakage
3. **Safety-First** — Approval gates on risky actions
4. **Transparency** — All decisions explainable
5. **Performance** — <2s chat, <30s workspace init
6. **Reliability** — Auto-recovery, graceful degradation
7. **End-to-End Autonomy** — Minimal user intervention needed

---

# NEXT STEPS

1. ✅ Review this Blueprint against team
2. 🔄 Prioritize Phase 2 items (focus on Context Engine + Model Fallback)
3. 📋 Create detailed task breakdowns per item
4. 🚀 Begin implementation sprint

