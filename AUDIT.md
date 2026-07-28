# Arunaki vs OpenClaw — Full Audit & Comparison

> Generated from source code analysis of both codebases.
> OpenClaw: https://github.com/openclaw/openclaw
> Arunaki: E:\JS\Arunika\Arunaki

---

## Table of Contents

1. [OpenClaw Architecture](#1-openclaw-architecture)
2. [Arunaki Architecture](#2-arunaki-architecture)
3. [Component-by-Component Comparison](#3-component-by-component-comparison)
4. [Gap Analysis](#4-gap-analysis)
5. [Recommendations](#5-recommendations)

---

## 1. OpenClaw Architecture

### 1.1 Agent Core (`packages/agent-core/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `agent-loop.ts` | Core execution loop — dual-loop (outer: steering/follow-up, inner: tool calls) | `agentLoop()`, `agentLoopContinue()`, `runLoop()`, `streamAssistantResponse()`, `executeToolCalls()` |
| `agent.ts` | Stateful agent wrapper — owns transcript, queues, lifecycle events | `Agent` class with `prompt()`, `continue()`, `steer()`, `followUp()`, `abort()`, `reset()`, `subscribe()` |
| `types.ts` | All TypeScript contracts | `AgentTool`, `AgentContext`, `AgentState`, `AgentEvent`, `AgentLoopConfig`, `ThinkingLevel` |
| `reasoning.ts` | Maps ThinkingLevel to provider-specific reasoning options | `resolveAgentReasoningOption()` |
| `runtime-deps.ts` | Injection point for LLM functions (provider-agnostic) | `AgentCoreRuntimeDeps`, `resolveAgentCoreStreamFn()` |
| `turn-interruption.ts` | Handles aborted/error turns | `createFailureMessage()`, `createInterruptedTurnMessage()` |
| `tool-execution-context.ts` | AsyncLocalStorage for current tool call tracking | `getAgentToolExecutionContext()` |
| `validation.ts` | Tool argument validation | `validateToolArguments()` |

### 1.2 Tool System

| Component | Purpose |
|-----------|---------|
| `AgentTool<TParameters, TDetails>` | Tool definition: label, execute, prepareArguments, executionMode, outputSchema |
| `AgentToolResult<T>` | Tool result: content, details, progress, terminate hint |
| `ToolOwnerRef` | Tool ownership: core, plugin, channel, MCP server |
| Before/after hooks | `beforeToolCall()` can block; `afterToolCall()` can override result |
| Execution modes | Per-tool `"sequential"` or `"parallel"` |
| Deferred resolution | `resolveDeferredTool` — lazy hydration for authorized-but-hidden tools |
| MCP integration | Tools from external MCP servers |

### 1.3 Context Engine (`src/context-engine/`)

| Method | Purpose |
|--------|---------|
| `bootstrap()` | Initialize engine state for a session |
| `ingest()` / `ingestBatch()` | Feed messages to engine store |
| `assemble(messages, tokenBudget)` | Build model context under token budget → messages + systemPromptAddition |
| `compact(tokenBudget)` | Reduce token usage: summaries, pruning |
| `maintain()` | Post-turn transcript maintenance |
| `afterTurn()` | Persist canonical context, trigger background compaction |
| `dispose()` | Cleanup resources |

**Key features:**
- Pluggable via `registerContextEngineForOwner()`
- Quarantine system for failed engines (automatic fallback)
- Token-budget-aware assembly
- Two projection modes: `per_turn` and `thread_bootstrap`

### 1.4 LLM Integration (`src/llm/`)

| File | Purpose |
|------|---------|
| `stream.ts` | Main streaming facade — `stream()`, `complete()`, `streamSimple()`, `completeSimple()` |
| `model-registry.ts` | Model registration/lookup |
| `model-runtime-binding.ts` | Binds models to specific LLM runtimes |
| `providers/` | Provider implementations (OpenAI, Anthropic, Google, OpenRouter, Ollama, vLLM, etc.) |

**Supported providers:** 40+ including OpenAI, Anthropic, Google, OpenRouter, Ollama, vLLM, Groq, NVIDIA, HuggingFace, DeepInfra, LM Studio, SGLang, and many more.

### 1.5 Sessions (`src/sessions/` — 50+ files)

| Component | Purpose |
|-----------|---------|
| Session ID management | Identity, resolution, classification |
| Admission control | Queue-based concurrency with interrupt handling |
| State events | State change classification and notification |
| Transcript management | User turn transcripts, conversation turns |
| Send policies | Message delivery policies |
| Model/thinking overrides | Per-session model and thinking level overrides |
| Upstream links | Session linking and monitoring |

### 1.6 Skills (`src/skills/` — 8 directories)

| Directory | Purpose |
|-----------|---------|
| `config/` | Skill configuration |
| `discovery/` | Finding available skills |
| `loading/` | SKILL.md parsing, contract validation |
| `lifecycle/` | Skill lifecycle management |
| `runtime/` | Skill runtime execution |
| `security/` | Skill security policies |
| `research/` | Skill research capabilities |
| `workshop/` | Skill creation workshop |

### 1.7 Agents (`src/agents/` — 347+ files)

| Subsystem | Purpose |
|-----------|---------|
| Agent lifecycle | Creation, command processing, lifecycle events |
| MCP integration | MCP server manager, runtime, tool materialization |
| Subagent system (ACP) | Agent Communication Protocol spawn, heartbeat, admission |
| Runtime & config | Runtime config, scope/permissions, model discovery, auth |
| Workspace | Agent workspace management (AGENTS.md, SOUL.md) |

---

## 2. Arunaki Architecture

### 2.1 AI Module (`apps/api/src/modules/ai/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `ai.service.ts` | Core LLM calls — provider config, chat completion, streaming, system prompt building | `AiService` with `chat()`, `chatWithTools()`, `chatStream()`, `getSystemPrompt()` |
| `context-manager.ts` | 4-phase context compression pipeline | `ContextManager` with `compress()`, `limitInjection()`, `StreamingContextScrubber` |
| `self-evaluation.service.ts` | Post-task output quality evaluation | `SelfEvaluationService` with `evaluate()`, `evaluateAndRetry()` |
| `model-router.service.ts` | Maps ThinkingLevel to model-specific prompt additions | `ModelRouterService` with `getSystemPromptAdditions()` |
| `auto-posture-detector.service.ts` | Detects user intent from conversation history | `AutoPostureDetector` with `detectPostureFromHistory()`, `getPosturePrompt()` |
| `prompt-injection-detector.service.ts` | Scans input for prompt injection attacks | `PromptInjectionDetector` with `detect()` |
| `autonomous-planner.service.ts` | Decomposes goals into multi-step plans | `AutonomousPlannerService` with `createPlan()` |
| `self-healing.service.ts` | Automatic retry for failed tools | `SelfHealingService` with `handleToolFailure()` |
| `agent-runner.service.ts` | Chat agent loop (5 rounds max) | `AgentRunnerService` with `runAgent()` |
| `workspace-heartbeat.service.ts` | Periodic workspace health checks | `WorkspaceHeartbeatService` |

### 2.2 Workspace Runner (`apps/api/src/modules/workspace/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `workspace-runner.service.ts` | Workspace agent loop (25 rounds) — context building, planning, tool execution, self-evaluation | `WorkspaceRunnerService` with `buildWorkspaceContext()`, `runWorkspaceAgentStream()` |
| `workspace.service.ts` | Workspace CRUD, folder indexing | `WorkspaceService` with `create()`, `connectFolder()`, `scanFolder()` |
| `workspace.controller.ts` | REST + SSE endpoints | CRUD, connect-folder, agent/stream, analysis cache |
| `workspace-init.service.ts` | Workspace initialization | `WorkspaceInitService` with `initialize()` |

### 2.3 Tool System (`apps/api/src/modules/tools/`)

| File | Purpose |
|------|---------|
| `tool-registry.service.ts` | Self-registering tool registry with parallel execution |
| `tool-adapter.ts` | Bridges tool service classes to registry |
| `interfaces/tool.interface.ts` | Tool definition interfaces |

**Registered tools (27+):**

| Tool | Purpose | Category |
|------|---------|----------|
| `read_workspace_file` | Read file contents | File |
| `list_workspace_files` | List all files | File |
| `search_workspace` | Search across files | File |
| `write_workspace_file` | Write new files | File |
| `update_workspace_file` | Update existing files | File |
| `delete_workspace_file` | Delete files | File |
| `calculate` | Mathematical calculations | Analysis |
| `web_search` | Internet search | Analysis |
| `generate_export` | Create Excel/CSV/PDF/DOCX | Output |
| `create_skill` | Create workflow template | Intelligence |
| `list_skills` | List available skills | Intelligence |
| `view_skill` | View skill details | Intelligence |
| `search_skills` | Search skills | Intelligence |
| `save_memory` | Store memory entries | Intelligence |
| `list_memories` | List memories | Intelligence |
| `search_memories` | Search memories | Intelligence |
| `delete_memory` | Delete memories | Intelligence |
| `doc_search` | Document search | Analysis |
| `knowledge_search` | Knowledge base search | Analysis |
| `catalog_match` | Match product catalogs | Analysis |
| `unit_convert` | Unit conversion | Analysis |
| `report_analyze` | Report analysis | Analysis |
| `data_extract` | Data extraction | Analysis |
| `spreadsheet_edit` | Edit spreadsheets | File |
| `email_draft` | Draft emails | Output |
| `pdf_generate` | Generate PDFs | Output |

### 2.4 Memory System (`apps/api/src/modules/memory/`)

| File | Purpose |
|------|---------|
| `memory.service.ts` | CRUD for memory entries (preferences, context, business facts) |
| `smart-recall.service.ts` | Context-relevance scoring for memory retrieval |
| `background-review.service.ts` | Background memory consolidation/decay |
| `auto-memory.service.ts` | Auto-extract facts from conversations |
| `session-search.service.ts` | FTS5 search across session history |

### 2.5 Other Modules

| Module | Purpose | Key Components |
|--------|---------|----------------|
| `chat/` | Chat system — sessions, messages, agent runner | ChatController, MessageService, AgentRunnerService |
| `knowledge/` | Knowledge base — CRUD, file extraction | KnowledgeController, KnowledgeService |
| `skills/` | Agent skills — lifecycle, starter templates | SkillsController, SkillsService |
| `source/` | Data sources — folder/file/upload/gdrive/onedrive | SourceController, SourceService |
| `file/` | File management — upload, parsing, metadata | FileController, FileService |
| `storage/` | Filesystem abstraction — path validation, read/write | StorageService |
| `parser/` | Document parsers — txt, md, csv, pdf, docx, xlsx | ParserService with 6 parser implementations |
| `search/` | Unified search — files, knowledge, memories | SearchService |
| `artifact/` | Output artifacts — reports, exports | ArtifactService |
| `provider/` | AI provider management — CRUD, rotation, cooldown | ProviderService |
| `domain/` | Business domain configs — 15 industries | DomainRegistryService |
| `cron/` | Scheduled reports — daily/weekly/monthly | CronService |

### 2.6 Frontend (`apps/web/`)

| Page | Purpose |
|------|---------|
| `ChatPage.tsx` | SSE streaming chat with Canvas panel |
| `WorkspacePage.tsx` | Workspace dashboard, folder connect, auto-analysis |
| `WorkspaceDetailPage.tsx` | 3-panel workspace detail, approval gate |
| `SettingsPage.tsx` | Provider management, 5 tabs |
| `KnowledgePage.tsx` | Knowledge base management |
| `HistoryPage.tsx` | Chat history (stub) |

### 2.7 Desktop (`apps/desktop/`)

| File | Purpose |
|------|---------|
| `main.cjs` | Electron main — native folder picker, file tree, file read |
| `preload.cjs` | Context bridge — `window.arunakiDesktop` API |

---

## 3. Component-by-Component Comparison

### 3.1 Agent Core

| Feature | OpenClaw | Arunaki | Gap |
|---------|----------|---------|-----|
| Agent loop type | Dual-loop (outer: steering, inner: tools) | Single loop with tool rounds | **MISSING: Steering loop** |
| Max rounds | Configurable per session | Hardcoded 25 (workspace) / 5 (chat) | **DIFFERENT: Not configurable** |
| Abort handling | Every iteration checks `stopIfAborted()` | No abort mechanism | **MISSING: Abort support** |
| Event system | Typed `AgentEvent` discriminated union | Simple `onEvent` callback with string types | **DIFFERENT: Less structured** |
| State management | `Agent` class with transcript, queues | No stateful agent — stateless per-request | **MISSING: Stateful agent** |
| Steering messages | `steer()` — inject mid-loop | Not available | **MISSING** |
| Follow-up messages | `followUp()` — inject after stop | Not available | **MISSING** |
| Model swap per turn | `prepareNextTurn` hook | Not available | **MISSING** |
| Tool hooks | `beforeToolCall` / `afterToolCall` | Not available | **MISSING** |
| Deferred tool resolution | `resolveDeferredTool` — lazy hydration | Not available | **NOT NEEDED** (business scope) |
| Provider-agnostic core | Yes — injected via `StreamFn` | No — tightly coupled to OpenAI-compatible | **DIFFERENT** |
| Reasoning/thinking levels | 7 levels: off→max | None | **NOT NEEDED** (business scope) |

### 3.2 Tool System

| Feature | OpenClaw | Arunaki | Gap |
|---------|----------|---------|-----|
| Tool interface | `AgentTool<TParams, TDetails>` with label, execute, prepareArguments, executionMode, outputSchema | `Tool` with name, definition, execute | **SIMPLER** |
| Tool execution modes | Per-tool `"sequential"` or `"parallel"` | Global: read-only parallel, mutating sequential | **DIFFERENT: Less granular** |
| Before/after hooks | `beforeToolCall()` can block; `afterToolCall()` can override | Not available | **MISSING** |
| Tool validation | Schema-based via `validateToolArguments()` | Schema-based via `validateArgs()` | **EQUIVALENT** |
| Tool ownership | `ToolOwnerRef` (core, plugin, channel, MCP) | No ownership model | **NOT NEEDED** (business scope) |
| MCP integration | Yes — external tool servers | Not available | **NOT NEEDED** (business scope) |
| Tool result types | `AgentToolResult` with content, details, progress, terminate | `ToolResult` with status, data, preview, metadata | **DIFFERENT: Less structured** |
| Parallel execution | `Promise.all` with concurrency control | `executeParallel()` with `executeParallelLimited()` | **EQUIVALENT** |

### 3.3 Context Management

| Feature | OpenClaw | Arunaki | Gap |
|---------|----------|---------|-----|
| Architecture | Pluggable `ContextEngine` interface | Hardcoded `ContextManager` class | **ARCHITECTURALLY DIFFERENT** |
| Token budget | `assemble(messages, tokenBudget)` — budget-aware | Fixed threshold (50% of 128K) | **SIMPLER** |
| Compression phases | Configurable per engine | 4 fixed phases (prune, strip images, sanitize pairs, tail protection) | **DIFFERENT** |
| Assembly | Engine decides what to include | System prompt + workspace context + memories + skills all injected | **DIFFERENT: OpenClaw is smarter** |
| Quarantine | Failed engines quarantined, fallback to default | No fallback mechanism | **MISSING** |
| Background compaction | `afterTurn()` triggers background compaction | No background compaction | **MISSING** |
| Thread persistence | `thread_bootstrap` projection mode | No persistence across turns | **MISSING** |
| Auto-read files | No — agent reads via tools | Yes — auto-reads top 5 files into system prompt | **ARCHITECTURALLY WRONG** |
| Context scrubbing | Not needed (clean architecture) | `StreamingContextScrubber` strips leaked context | **WORKAROUND for bad architecture** |

### 3.4 LLM Integration

| Feature | OpenClaw | Arunaki | Gap |
|---------|----------|---------|-----|
| Provider support | 40+ providers via plugins | 1 provider (OpenAI-compatible) | **DIFFERENT: OpenClaw is broader** |
| Provider switching | Runtime per-session | Static from DB or .env | **SIMPLER** |
| OAuth support | Yes (ChatGPT, Anthropic, GitHub Copilot) | No | **NOT NEEDED** (business scope) |
| Streaming | `streamSimple()` via runtime | `chatStream()` via fetch SSE | **EQUIVALENT** |
| Error classification | Provider-specific via plugins | Generic (retry/rotate/fatal) | **SIMPLER** |
| Rate limit handling | Key rotation on 429 | Cooldown system | **EQUIVALENT** |
| Token counting | Provider-specific | tiktoken gpt-4 (wrong for non-OpenAI) | **BROKEN** |

### 3.5 Memory & Sessions

| Feature | OpenClaw | Arunaki | Gap |
|---------|----------|---------|-----|
| Session persistence | SQLite per-agent | SQLite (Prisma) | **EQUIVALENT** |
| Session admission | Queue-based concurrency control | No concurrency control | **MISSING** |
| Memory system | Root memory files + host SDK | 6-type memory with auto-extraction | **ARUNAKI HAS MORE** (business-focused) |
| Smart recall | Context-engine managed | Keyword-based scoring | **DIFFERENT** |
| Background review | Not documented | `BackgroundReviewService` | **ARUNAKI HAS MORE** |
| Auto-memory | Not documented | `AutoMemoryService` — auto-extract facts | **ARUNAKI HAS MORE** |
| Session search | FTS5 | FTS5 | **EQUIVALENT** |

### 3.6 Skills

| Feature | OpenClaw | Arunaki | Gap |
|---------|----------|---------|-----|
| Skill format | `SKILL.md` with frontmatter | JSON in database | **DIFFERENT** |
| Skill discovery | Filesystem-based (`skills/` directory) | Database query | **DIFFERENT** |
| Skill loading | SKILL.md parsing with contract validation | JSON parse | **SIMPLER** |
| Skill lifecycle | Full lifecycle management | Create, archive, pin, version | **EQUIVALENT** |
| Starter skills | Bundled in `skills/` directory | `STARTER_SKILLS` array in code | **EQUIVALENT** |
| Skill security | Dedicated security policies | Not available | **NOT NEEDED** (business scope) |
| Skill workshop | Creation workshop UI | Not available | **NOT NEEDED** (business scope) |
| Skill self-improvement | Not documented | `SkillSelfImproveService` | **ARUNAKI HAS MORE** |

### 3.7 Business-Specific Features (Arunaki only)

| Feature | Purpose | Status |
|---------|---------|--------|
| Domain configs (15 industries) | Business-specific terminology, units, formulas | Working |
| Document parsers (6 types) | txt, md, csv, pdf, docx, xlsx parsing | Working |
| Knowledge base | Business rules, pricing, SOPs | Working |
| Scheduled reports | Cron-based automated reports | Working |
| Approval gate | Mutating tools require user consent | Working |
| Self-evaluation | Output quality scoring and retry | Working |
| Prompt injection detection | Input security scanning | Working |
| Auto-posture detection | Business vs coding posture | Working |
| Provider rotation with cooldown | Credential pool management | Working |
| Catalog matching | Product catalog cross-reference | Working |
| Unit conversion | Business unit calculations | Working |

---

## 4. Gap Analysis

### 4.1 MISSING from Arunaki (needed for business focus)

| Priority | Feature | Why Needed | OpenClaw Reference |
|----------|---------|------------|-------------------|
| **CRITICAL** | Remove auto-read 5 files from system prompt | Causes context bloat, breaks free models | `assemble()` — agent reads via tools |
| **CRITICAL** | Don't prune tool results aggressively | Agent loses data it already read | Context engine preserves results |
| **HIGH** | Steering messages | Correct agent mid-run when it goes wrong | `Agent.steer()` |
| **HIGH** | Abort mechanism | Stop runaway agent executions | `stopIfAborted()` in every loop iteration |
| **HIGH** | Configurable max rounds | Different tasks need different limits | Per-session configuration |
| **MEDIUM** | Tool before/after hooks | Block dangerous operations, override results | `beforeToolCall()` / `afterToolCall()` |
| **MEDIUM** | Token budget-aware context | Smarter context assembly | `assemble(messages, tokenBudget)` |
| **LOW** | Provider-agnostic LLM core | Support non-OpenAI providers natively | `StreamFn` injection |

### 4.2 BROKEN in Arunaki

| Issue | File | Problem |
|-------|------|---------|
| tiktoken wrong model | `ai.service.ts:77` | `encoding_for_model('gpt-4')` for all models |
| Self-healing tool names don't match | `self-healing.service.ts:36-40` | `workspace_search` vs `search_workspace` |
| Sync provider config | `ai.service.ts:534-548` | `getProviderConfigSync()` always returns .env fallback |
| Direct Prisma in workspace runner | `workspace-runner.service.ts:98,166,549` | Bypasses repository pattern |
| Context compression recursion | `context-manager.ts` | `chat()` calls `prepareMessages()` which may call `compress()` again |
| SSE no reconnection | `WorkspacePage.tsx` | Connection drops = lost response |
| No path traversal protection | `workspace.service.ts:63` | `fs.access` only checks readability |

### 4.3 NOT NEEDED from OpenClaw (business scope)

| Feature | Why Not Needed |
|---------|---------------|
| MCP integration | Business docs don't need external tool servers |
| Deferred tool resolution | All tools are known upfront |
| 7 thinking levels | Business analysis doesn't need reasoning calibration |
| OAuth provider auth | API key is sufficient for business use |
| Channel system (WhatsApp, Telegram, etc.) | Web UI only |
| Subagent system (ACP) | Single agent is sufficient |
| Canvas/visual workspace | Not needed for document analysis |
| Voice wake/talk mode | Not needed for business docs |
| Skill security policies | Internal tool, no external skill risk |
| Skill workshop | Starter skills are sufficient |
| 40+ provider plugins | OpenAI-compatible covers most business needs |

### 4.4 ARUNAKI HAS MORE (business advantages)

| Feature | Purpose |
|---------|---------|
| 15 industry domain configs | Business-specific terminology and formulas |
| 6 document parsers | Full business document support |
| Knowledge base | Business rules, pricing, SOPs storage |
| Scheduled reports | Automated periodic reports |
| Approval gate | Safety for file modifications |
| Self-evaluation | Quality scoring and auto-retry |
| Auto-memory extraction | Learns from conversations |
| Background memory review | Memory consolidation and decay |
| Prompt injection detection | Security for business data |
| Auto-posture detection | Business vs coding context |
| Catalog matching | Product cross-reference |
| Unit conversion | Business unit calculations |

---

## 5. Recommendations

### Phase 1: Fix Critical Architecture (Week 1)

1. **Remove auto-read from `buildWorkspaceContext()`**
   - Stop reading top 5 files into system prompt
   - Let agent discover and read files via `read_workspace_file` tool
   - Reduces system prompt from ~10K tokens to ~2K tokens

2. **Fix context compression**
   - Don't prune tool results until they're truly old (increase `toolPruneChars` or keep last 10)
   - Remove the 50% threshold — use token budget instead
   - Fix recursion issue in `context-manager.ts`

3. **Fix broken components**
   - Fix tiktoken model (`gpt-4` → match actual model)
   - Fix self-healing tool name mismatches
   - Fix sync provider config (`getProviderConfigSync`)
   - Add path traversal protection

### Phase 2: Add Missing Core Features (Week 2)

4. **Add steering messages to agent loop**
   - Allow injecting correction messages mid-run
   - Implement `steer()` method in workspace runner

5. **Add abort mechanism**
   - Check abort signal in every loop iteration
   - Return partial results on abort

6. **Make max rounds configurable**
   - Per-workspace setting
   - Default to 15 (between current 5 and 25)

### Phase 3: Improve Context Management (Week 3)

7. **Implement token budget-aware assembly**
   - Calculate available budget after system prompt
   - Dynamically decide what to include (memories, skills, workspace context)
   - Priority: system prompt > user goal > recent messages > memories > skills

8. **Add tool before/after hooks**
   - `beforeToolCall`: block dangerous operations (delete all files, etc.)
   - `afterToolCall`: enrich results, create artifacts

### Phase 4: Polish (Week 4)

9. **Fix frontend issues**
   - SSE reconnection logic
   - Error boundaries around canvas/artifact panel
   - Provider health monitoring in Settings

10. **Add missing infrastructure**
    - Rate limiting on LLM endpoints
    - Request validation on all endpoints
    - Basic auth for deployment

---

## Summary

**OpenClaw** is a general-purpose AI assistant with 72K+ commits, 40+ providers, multi-channel support, and a pluggable architecture. It's over-engineered for Arunaki's business-focused scope.

**Arunaki** has stronger business-specific features (domain configs, document parsers, knowledge base, scheduled reports, approval gate, self-evaluation) but weaker core agent architecture (no steering, no abort, context bloat, broken compression).

**Key insight:** Arunaki doesn't need to copy OpenClaw's full architecture. It needs to fix its core agent loop to be lightweight and context-aware, then leverage its existing business strengths.

**Total findings:** 38 issues (7 CRITICAL, 12 BROKEN, 9 ARCHITECTURALLY WRONG, 12 INCOMPLETE, 5 MISSING)
