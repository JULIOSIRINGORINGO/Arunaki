# Context Engine — OpenClaw vs Arunaki

> **UPDATE 2026-07-29:** Deskripsi Arunaki di bawah ini adalah keadaan **SEBELUM Phase 24**. Setelah Phase 24:
> - Context Engine Registry sudah diimplementasikan (6 file: interface, registry, legacy wrapper, projection assembler, quarantine, module)
> - `projection-assembler.service.ts` mengumpulkan context dari workspace/memory/skills/knowledge
> - Context **direfresh setiap 5 rounds** via `prepareNextTurn()` di dual-loop agent
> - `useLlmSummary` masih true (belum dimatikan)
> - Belum ada token budget dinamis ala OpenClaw
> 
> **Dokumen ini tetap dipertahankan** sebagai referensi pola OpenClaw projection assembly untuk pengembangan ke depan.

## Executive Summary

OpenClaw's context engine is a **registry-based assembly system** with quarantine, fallback, and token-budget-aware projection. Pre-Phase 24, Arunaki's was a **4-phase compression pipeline** that ran once at startup. The fundamental difference: OpenClaw assembles context fresh each turn.

---

## OpenClaw Context Engine

### Architecture: Registry + Assembly

```
┌─────────────────────────────────────────────────┐
│  ContextEngine (Registry)                       │
│  ┌─────────────────────────────────────────────┐ │
│  │  Projections:                               │ │
│  │    system    → SystemPromptProjection       │ │
│  │    tools     → ToolOutputProjection         │ │
│  │    memory    → MemoryProjection             │ │
│  │    knowledge → KnowledgeProjection          │ │
│  │    files     → FileProjection               │ │
│  │    ...extensible via register()             │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  assemble(messages, tokenBudget)                │
│    → Query each projection for parts            │
│    → Quarantine oversized parts                 │
│    → Fallback for failed projections            │
│    → Fit within token budget                    │
│    → Return assembled context                   │
│                                                 │
│  ingest(event)                                  │
│    → Feed file changes, memory updates          │
│    → Projections update their state             │
│                                                 │
│  compact()                                      │
│    → Aggressive compression when near limit     │
│    → Drop low-priority parts first              │
│                                                 │
│  maintain()                                     │
│    → Periodic cleanup of stale data             │
│    → pruneOldToolResults, stripOldImages        │
└─────────────────────────────────────────────────┘
```

### Key Concepts

#### 1. Projections (Modular Context Sources)

Each projection is a self-contained module that provides a specific type of context:

```typescript
interface ContextProjection {
  name: string;
  priority: number;  // Higher = more important, kept longer

  // Provide context parts for assembly
  assemble(messages: ChatMessage[], budget: TokenBudget): ContextPart[];

  // Handle events (file changes, memory updates, etc.)
  ingest(event: ContextEvent): void;

  // Cleanup stale data
  maintain(): void;
}
```

**Example projections:**
- `SystemPromptProjection` — Always included, never compressed
- `ToolOutputProjection` — Tool results, pruned by age
- `MemoryProjection` — Relevant memories, scored by relevance
- `FileProjection` — File previews, updated on file changes

#### 2. Token Budget (Dynamic Allocation)

```typescript
interface TokenBudget {
  total: number;        // e.g., 128000
  used: number;         // Currently consumed
  reserved: number;     // Reserved for response generation
  available: number;    // total - used - reserved

  // Allocate budget to projections
  allocate(projection: string, maxTokens: number): number;
}
```

OpenClaw dynamically allocates budget per turn:
- System prompt: fixed ~2000 tokens
- Tool results: variable, pruned oldest-first
- Memory: up to 10% of budget
- File previews: up to 15% of budget
- Response reserve: ~4000 tokens

#### 3. Quarantine (Graceful Degradation)

When a projection's output exceeds its budget:

```typescript
// Instead of crashing, quarantine the oversized part
quarantine(part: ContextPart, reason: string): void {
  this.quarantined.push({
    part,
    reason,
    timestamp: Date.now(),
    priority: part.priority,
  });
  // Continue with other projections
}
```

Later, if budget allows, quarantined parts can be re-included.

#### 4. Fallback (Error Resilience)

```typescript
// If a projection fails, try fallback
try {
  parts = await projection.assemble(messages, budget);
} catch (error) {
  this.logger.warn(`Projection ${projection.name} failed: ${error.message}`);
  parts = projection.fallback
    ? await projection.fallback.assemble(messages, budget)
    : [];
  this.quarantine({ ...error context, priority: 0 }, 'projection_failed');
}
```

#### 5. Two Projection Modes

```typescript
// Mode 1: Full assembly (for main agent loop)
const context = await engine.assemble(messages, tokenBudget);

// Mode 2: Minimal assembly (for streaming, quick responses)
const minimal = await engine.assembleMinimal(messages, {
  includeSystem: true,
  includeTools: false,
  includeMemory: false,
});
```

### Context Lifecycle

```
1. bootstrap()
   → Initialize projections
   → Load initial state (files, memories, etc.)
   → Set up event listeners

2. ingest(event)
   → File changed → FileProjection updates
   → Memory saved → MemoryProjection updates
   → Tool called → ToolOutputProjection updates

3. assemble(messages, tokenBudget)
   → Each projection provides parts
   → Parts are ranked by priority
   → Budget is allocated
   → Oversized parts quarantined
   → Final context returned

4. compact()
   → Triggered when context > 80% of budget
   → Drop lowest-priority quarantined parts
   → Summarize middle conversation turns
   → Prune old tool results

5. maintain()
   → Periodic cleanup (every N turns)
   → Remove stale memories
   → Compress old file previews
   → Garbage collect quarantined parts

6. afterTurn()
   → Called after each agent turn
   → Update projections with new state
   → Check if compaction needed
```

---

## Arunaki Context Engine (Current)

### Architecture: 4-Phase Compression Pipeline

```
┌─────────────────────────────────────────┐
│  ContextManager                          │
│  ┌─────────────────────────────────────┐ │
│  │  compress(messages)                 │ │
│  │    Phase 1: pruneOldToolResults()   │ │  ← Keep last 3 unpruned
│  │    Phase 2: stripOldImages()        │ │  ← Keep last 2 unstripped
│  │    Phase 3: sanitizeToolPairs()     │ │  ← Fix orphaned calls/results
│  │    Phase 4: protectTailAndSummarize │ │  ← Head + summary + tail
│  └─────────────────────────────────────┘ │
│                                         │
│  estimateTokens(messages)               │  ← Char-based (~4 chars/token)
│  limitInjection(content, label)         │  ← Truncate to 7000 chars
└─────────────────────────────────────────┘
```

### What Each Phase Does

#### Phase 1: Prune Old Tool Results
```typescript
// Keep last 3 tool results unpruned
// Replace older ones with preview (500 chars)
if (msg.role === 'tool' && msg.content.length > 2000) {
  if (toolIndex < toolIndices.length - 3) {
    return { content: `[Old tool output cleared]\n${preview}\n...[truncated]` };
  }
}
```

#### Phase 2: Strip Old Images
```typescript
// Keep last 2 images, replace older ones with placeholder
if (content.includes('data:image/')) {
  if (imageIndex < imageIndices.length - 2) {
    return { content: '[Image removed to save context space]' };
  }
}
```

#### Phase 3: Sanitize Tool Pairs
```typescript
// Remove orphaned tool_results (no matching tool_call)
// Inject stub results for tool_calls without results
// Prevents API errors from broken message sequences
```

#### Phase 4: Protect Tail + Summarize
```typescript
// Split: [system] + [head: first 3 messages] + [middle] + [tail]
// Compress middle section into summary (LLM or template)
// Reassemble: system + head + summary + tail
```

### What's Missing vs OpenClaw (Post-Phase 24)

| Feature | OpenClaw | Arunaki Sekarang | Impact |
|---------|----------|-----------------|--------|
| Registry | Modular projections | ✅ **Sudah** (context-registry.service.ts + 6 files) | Bisa register context sources baru |
| Token budget | Dynamic per-projection | ⚠️ **Fixed 128k total** | Alokasi belum efisien |
| Quarantine | Graceful degradation | ⚠️ **Ada** (context-quarantine.service.ts) | Partial — masih perlu fallback |
| Fallback | Projection-specific | ❌ **Belum** | Single point of failure |
| Ingest | Real-time event-driven | ✅ **Ada** — context refresh per 5 rounds | Tidak sereal time OpenClaw |
| Compact | On-demand + periodic | ✅ **Ada** — compression tiap chat | Overhead CPU |
| Maintain | Periodic cleanup | ❌ **Belum** | Potensi memory leak |
| Priority | Per-part priority | ❌ **Belum** | Data penting hilang sama rata |
| Two modes | Full + minimal | ⚠️ Satu mode | Belum bisa quick responses |

### The Core Problem (Pre-Phase 24)

**Pre-Phase 24, Arunaki built context ONCE at the start of `runWorkspaceAgentStream()`:**

```typescript
// workspace-runner.service.ts (old behavior)
const workspaceContext = await this.buildWorkspaceContext(workspaceId);
// ^ This was called ONCE. Never refreshed.
```

**Sekarang (Phase 24+):** Context direfresh setiap 5 rounds via `prepareNextTurn()` di dual-loop agent. Setiap refresh memanggil `contextRegistry.getActive().assemble()` melalui projection assembler yang mengumpulkan context terbaru dari workspace, memory, skills, dan knowledge sources.

Then it enters a 25-round loop where the context gets progressively more stale:
- Round 1: Fresh context, accurate file list
- Round 5: Files may have changed, new memories created
- Round 10: Context is significantly outdated
- Round 25: Context is completely stale

**OpenClaw calls `assemble()` every turn**, getting fresh context each time.

### The Compression Problem

Arunaki's `ContextManager` is initialized with:
```typescript
this.contextManager = new ContextManager(
  {
    contextLength: 128000,
    threshold: 0.5,        // Compress at 64k tokens
    targetRatio: 0.2,      // Tail gets 20% of budget
    useLlmSummary: true,   // Uses ANOTHER LLM call for summary
  },
  { chat: this.chat.bind(this) },
);
```

**Problem 1:** `useLlmSummary: true` means compression triggers an ADDITIONAL LLM call just to summarize. For free models with rate limits, this is wasteful.

**Problem 2:** The `estimateTokens()` method uses char-based estimation (`length / 4`), which is inaccurate for non-English text (Indonesian chars are often multi-byte).

**Problem 3:** Compression runs on EVERY `chat()` call, even when context is small. No early exit optimization.

---

## Target Architecture for Arunaki

### Phase 1: Add Token Budget System

```typescript
class TokenBudget {
  constructor(
    private readonly total: number,
    private readonly reserved: number = 4000,
  ) {}

  allocate(category: string, maxTokens: number): number {
    const available = this.total - this.used - this.reserved;
    const allocated = Math.min(maxTokens, available);
    this.allocations.set(category, allocated);
    this.used += allocated;
    return allocated;
  }
}
```

### Phase 2: Add Context Refresh per Turn

```typescript
// In the agent loop, after each round:
async prepareNextTurn(workspaceId: string, messages: ChatMessage[]) {
  // Only refresh if significant changes detected
  const changes = this.heartbeatService.getLatestChanges(workspaceId);
  if (changes.hasNewFiles || changes.hasModifiedFiles) {
    const freshContext = await this.buildWorkspaceContext(workspaceId);
    // Inject as system message
    messages.push({
      role: 'system',
      content: `[Context Updated]\n${freshContext}`,
    });
  }
}
```

### Phase 3: Add Quarantine + Fallback

```typescript
// Instead of truncating, quarantine oversized parts
const contextParts = await this.assembleContext(workspaceId, tokenBudget);

for (const part of contextParts) {
  if (part.tokens > part.budget) {
    this.quarantine(part, 'exceeds_budget');
    // Try fallback: summarize this part specifically
    const summary = await this.summarizePart(part);
    contextParts.push(summary);
  }
}
```

### Phase 4: Simplify Compression

```typescript
// Remove LLM-based summary (wasteful for free models)
// Use template-based summary only
// Add early exit when under threshold
async compress(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const tokens = this.estimateTokens(messages);
  if (tokens < this.config.contextLength * 0.5) {
    return messages;  // Early exit — no compression needed
  }
  // ... existing phases
}
```

---

## Key Insight

**OpenClaw's context engine is "assemble fresh every turn."** This means:
- Context is always accurate
- Token budget is dynamically allocated
- Failed projections don't crash the system
- New context sources can be added without changing the core

**Arunaki's context engine is "compress once at startup."** This means:
- Context gets stale during long runs
- Token budget is fixed and inefficient
- Failed compression crashes the system
- Adding new context sources requires modifying the pipeline

**The fix: Move from "compress" to "assemble." Build context fresh each turn, not compress once at start.**
