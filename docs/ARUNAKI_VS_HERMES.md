# Arunaki vs Hermes Agent: Analisis & Rekomendasi

## Ringkasan Eksekutif

Hermes Agent (dahulu OpenClaw) adalah **agent framework** yang bisa pakai model gratisan (OpenRouter free tier) dan tetap bisa bekerja secara autonomous. Arunaki punya **tool system** yang mirip tapi kurang di **framework layer** — system prompt, agent loop, context management, dan skills system.

**Temuan Kritis: Ada BUG di Arunaki** — Workspace mode TIDAK PERNAH mendapat system prompt autonomous karena parameter yang salah posisi (lihat Bagian 3).

---

## 1. Perbandingan Arsitektur

### Hermes Agent
```
┌─────────────────────────────────────────────┐
│              FRAMEWORK LAYER                 │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ System Prompt│  │ Agent Loop           │  │
│  │ 3-tier       │  │ - Error handling     │  │
│  │ (stable/     │  │ - Retry + backoff    │  │
│  │  context/    │  │ - Context compress   │  │
│  │  volatile)   │  │ - Interrupt & steer  │  │
│  └─────────────┘  │ - Sub-agent delegate │  │
│                   │ - Parallel tools     │  │
│  ┌─────────────┐  └──────────────────────┘  │
│  │ Memory       │  ┌──────────────────────┐  │
│  │ - MEMORY.md  │  │ Skills System        │  │
│  │ - USER.md    │  │ - Auto-create        │  │
│  │ - Provider   │  │ - Self-improve       │  │
│  │   abstract   │  │ - Background review  │  │
│  └─────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────┐   │
│  │ Tools (~45 tools)                     │   │
│  │ web, terminal, files, vision, skills,│   │
│  │ planning, delegation, browser, etc.  │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│              LLM (any provider)              │
│  GPT-4 / Claude / Hermes / Model gratisan   │
└─────────────────────────────────────────────┘
```

### Arunaki (sekarang)
```
┌─────────────────────────────────────────────┐
│              FRAMEWORK LAYER                 │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ System Prompt│  │ Agent Loop           │  │
│  │ Flat string  │  │ - MAX_ROUNDS = 5/25 │  │
│  │ No tiers     │  │ - No error handling  │  │
│  │ No context   │  │ - No retry           │  │
│  │ management   │  │ - No compress        │  │
│  └─────────────┘  │ - Sequential only    │  │
│                   └──────────────────────┘  │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Knowledge    │  │ Skills System        │  │
│  │ (flat blob)  │  │ ✅ Basic CRUD        │  │
│  │ No memory    │  │ - create/view/search │  │
│  │ across       │  │ - auto-create from   │  │
│  │ sessions     │  │   experience         │  │
│  └─────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────┐   │
│  │ Memory System                        │   │
│  │ ✅ Basic persistence                 │   │
│  │ - preference, context, history       │   │
│  │ - auto-save after tasks              │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │ Tools (~16 tools)                     │   │
│  │ document, export, search, knowledge, │   │
│  │ web, vision, workspace, etc.         │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│              LLM (OpenRouter)                │
│  nemotron (free tier) — model terbatas      │
└─────────────────────────────────────────────┘
```

---

## 2. Perbandingan Detail

### 2.1 System Prompt

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **Struktur** | 3-tier (stable/context/volatile) | Flat string, 1 level |
| **Prefix cache** | Dirancang untuk Anthropic prefix-cache KV reuse | Tidak ada optimasi |
| **Timestamp** | Date-only (stabil sepanjang hari) | Tidak ada |
| **Tool guidance** | Per-model instructions (GPT, Claude, Gemini, dll) | Generic, tidak ada per-model |
| **Platform hints** | 20+ platform (Telegram, Discord, dll) | Hanya web |
| **Context files** | Auto-discover AGENTS.md, .cursorrules, dll | ❌ Tidak ada |
| **Memory injection** | MEMORY.md + USER.md di volatile tier | Knowledge base flat blob |
| **Security** | Prompt injection scanning | ❌ Tidak ada |

**Kesimpulan**: System prompt Arunaki terlalu generik. Tidak ada panduan spesifik untuk model tertentu, tidak ada context management, tidak ada security layer.

### 2.2 Agent Loop

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **MAX_ROUNDS** | Unlimited (iteration budget-based) | 5 (chat) / 25 (workspace) |
| **Error handling** | 73KB error classifier, 7 kategori | fetchWithRetry (429/500) |
| **Retry** | Adaptive backoff + jittered wait | ✅ Exponential backoff |
| **Credential pool** | API key rotation + failover | 1 API key statis |
| **Context compression** | Multi-path (pre-API, overflow, post-tool) | ✅ Tool pruning + truncation |
| **Parallel tools** | ThreadPoolExecutor untuk tools independen | Sequential (approval gate safe) |
| **Interrupt & redirect** | User bisa interupsi mid-execution | ❌ Tidak ada |
| **Sub-agent delegation** | Spawn isolated child agents | ❌ Tidak ada |
| **Stream handling** | Streaming + continuation prompts | SSE basic |
| **Budget management** | Shared iteration budget parent+child | Fixed MAX_ROUNDS |

**Kesimpulan**: Agent loop Arunaki sudah **60%** — error retry dan context management sudah jalan. Yang belum: interrupt & redirect, sub-agent delegation, credential pool.

### 2.3 Tool System

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **Jumlah tools** | ~45 tools | 16 tools |
| **Toolset system** | Composable groups (web, terminal, files, etc) | Flat list |
| **Check functions** | TTL-cached availability checks | ❌ Tidak ada |
| **Dynamic schemas** | Schema overrides per context | ❌ Static schemas |
| **Security** | Path traversal, injection scanning | Basic validation |
| **Result format** | JSON + multimodal envelope | JSON + preview string |
| **Dispatch** | Async + sync with timeout | Sync with timeout |

**Kesimpulan**: Tool system Arunaki cukup solid secara struktur (OpenAI function calling format), tapi kurang features: tidak ada toolset composition, tidak ada availability checking, tidak ada dynamic schemas.

### 2.4 Skills System

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **Existence** | ✅ Full skills system | ✅ Basic skills system |
| **Auto-create** | Agent bisa buat skill dari pengalaman | ✅ Agent bisa create skill |
| **Self-improve** | Skill patch otomatis saat outdated | ❌ |
| **Progressive disclosure** | 3-tier (list → view → files) | ✅ Basic (list → view → content) |
| **Background review** | Curator review tiap 7 hari | ❌ |
| **Skills Hub** | Share skills dengan komunitas | ❌ |
| **Security** | Injection scanning, write approval | ❌ |

**Kesimpulan**: Skills system Arunaki sudah **40%** — basic CRUD + agent bisa create skill dari pengalaman. Yang belum: self-improve, background review, Skills Hub, security.

### 2.5 Memory System

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **Existence** | ✅ Full memory system | ✅ Basic memory system |
| **Persistence** | MEMORY.md + USER.md + external providers | ✅ Database (Memory model) |
| **Cross-session** | ✅ Ingat di semua sesi | ✅ Workspace history + preferences |
| **Provider abstraction** | ABC interface, bisa plug provider apapun | ❌ SQLite only |
| **Context fencing** | XML tags, injection prevention | ❌ |
| **Prefetch** | Background recall sebelum turn | ❌ |
| **Sync** | Background thread, serialized writes | ❌ |

**Kesimpulan**: Memory system Arunaki sudah **40%** — basic CRUD + auto-save workspace history + preference tracking. Yang belum: provider abstraction, context fencing, prefetch, sync.

### 2.6 Context Management

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **Token counting** | ✅ Hitung token sebelum API call | ✅ tiktoken integration |
| **Compression** | Multi-path: pre-API, overflow, post-tool | ⏳ Tool pruning + truncation (partial) |
| **Message pruning** | Tool results diganti placeholder | ✅ Large outputs compressed |
| **History truncation** | Sliding window + summarization | ✅ Sliding window (token budget) |
| **Image stripping** | Old images diganti placeholder | ❌ |
| **Session rotation** | New session saat compress | ❌ |
| **Lock safety** | SQLite compression lock | ❌ |

**Kesimpulan**: Context management Arunaki sudah **70%** — token counting, tool pruning, dan history truncation sudah jalan. Yang belum: image stripping, session rotation, dan full compression.

---

## 3. BUG KRITIS: Workspace Mode Tidak Pernah Aktif

### Status: ✅ SUDAH DIPERBAIKI

### Masalah (SUDAH FIXED)

Di `workspace-runner.service.ts` line 66:
```typescript
// SEBELUM (bug):
const systemPrompt = this.aiService.getSystemPrompt('workspace', undefined, workspaceContext);

// SESUDAH (fixed):
const systemPrompt = this.aiService.getSystemPrompt('workspace', workspaceContext);
```

Parameter `workspaceContext` sekarang dikirim ke posisi yang benar (posisi ke-2, bukan ke-3).

### Dampak (SEBELUM FIXED)
- Workspace agent selalu dapat system prompt chat mode (bukan autonomous)
- File listing di-inject sebagai "knowledge base" bukan sebagai workspace context
- Agent tidak punya panduan autonomous yang benar

---

## 4. Mengapa Hermes Agent Bisa Pakai Model Gratisan

### Jawaban: Framework-nya yang Compensate

1. **System prompt yang sangat well-crafted**
   - Per-model guidance (GPT beda dengan Claude beda dengan Gemini)
   - Explicit instructions untuk setiap tool
   - Context files yang auto-discover
   - Memory yang persist lintas sesi

2. **Agent loop yang resilient**
   - Error classification → tahu kapan retry, kapan skip
   - Credential pool → kalau 1 API key rate limit, switch ke lain
   - Context compression → bisa handle percakapan panjang
   - Interrupt & redirect → user bisa koreksi mid-execution

3. **Skills system**
   - Agent belajar dari pengalaman
   - Workflow yang berhasil disimpan sebagai skill
   - Skill self-improve saat dipakai
   - Background curator review berkala

4. **Memory system**
   - Agent ingat user preferences
   - Ingat percakapan sebelumnya
   - Bisa recall konteks relevan

**Intinya**: Model gratisan (nempton GPT-4) tapi framework-nya guide dia step-by-step, handle error, manage context, dan learn from experience. Hasilnya = kerja bagus meski model lemah.

---

## 5. Rekomendasi untuk Arunaki

### Prioritas 1: Fix Bug + Basic Framework (Minggu 1-2)

1. ✅ **Fix workspace system prompt bug** — parameter posisi
2. ✅ **Token counting** — hitung token sebelum API call, handle overflow
3. ✅ **History truncation** — sliding window, jangan kirim semua history
4. ✅ **Tool result pruning** — compress large tool results
5. ✅ **Error retry** — retry 1-2x untuk transient errors (429/500)
6. ⏳ **Parallel tool execution** — deferred (sequential lebih aman untuk approval gate)

### Prioritas 2: Agent Intelligence (Minggu 3-4)

1. ✅ **Skills system (basic)**
   - ✅ Simpan workflow yang berhasil sebagai "skill"
   - ✅ Saat workspace baru, cek apakah ada skill yang relevan
   - ✅ Agent bisa create skill baru dari pengalaman

2. ✅ **Context compression**
   - ✅ Summary lama percakapan (tool pruning + truncation)
   - ✅ Prune tool results yang sudah tua
   - Protect system prompt + recent messages

3. ✅ **Memory (basic)**
   - ✅ Simpan user preferences
   - ✅ Ingat workspace yang pernah dikerjakan
   - ✅ Cross-session recall (workspace history)

### Prioritas 3: Advanced Features (Minggu 5+)

1. **Sub-agent delegation** — spawn child agents untuk tugas paralel
2. **Interrupt & redirect** — user bisa koreksi mid-execution
3. **Credential pool** — multiple API keys untuk failover
4. **Skills Hub** — share skills dengan komunitas
5. **Background curator** — auto-review skills berkala

---

## 6.Arsitektur Target

```
┌─────────────────────────────────────────────┐
│              FRAMEWORK LAYER                 │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ System Prompt (3-tier)               │   │
│  │ - Stable: identity + tool guidance   │   │
│  │ - Context: workspace + knowledge     │   │
│  │ - Volatile: memory + timestamp       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌──────────────┐  ┌───────────────────┐   │
│  │ Agent Loop    │  │ Context Manager   │   │
│  │ - MAX = 50   │  │ - Token counting  │   │
│  │ - Retry 2x   │  │ - Compression     │   │
│  │ - Error class │  │ - Sliding window  │   │
│  │ - Interrupt   │  │ - Tool pruning    │   │
│  │ - Parallel    │  │ - Session rotate  │   │
│  └──────────────┘  └───────────────────┘   │
│                                             │
│  ┌──────────────┐  ┌───────────────────┐   │
│  │ Skills System │  │ Memory System     │   │
│  │ - Auto-create │  │ - Preferences     │   │
│  │ - Self-improve│  │ - Workspace history│  │
│  │ - Progressive │  │ - Cross-session   │   │
│  │ - Background  │  │ - Smart recall    │   │
│  └──────────────┘  └───────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Tools (composable toolsets)          │   │
│  │ workspace | document | export |      │   │
│  │ search | calculate | web | vision    │   │
│  └─────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│              LLM (OpenRouter)                │
│  nempton GPT-4 / Claude / model apapun     │
└─────────────────────────────────────────────┘
```

---

## 7. Kesimpulan

| Aspect | Status Sekarang | Target |
|--------|----------------|--------|
| Tool System | ✅ Solid (16 tools) | ✅ + toolsets |
| System Prompt | ⚠️ Flat, workspace fixed | ✅ 3-tier |
| Agent Loop | ⚠️ Basic + retry + context mgmt | ✅ Resilient |
| Context Management | ⚠️ 70% done (token/prune/truncate) | ✅ Full compression |
| Skills System | ❌ Tidak ada | ✅ Auto-learn |
| Memory System | ❌ Tidak ada | ✅ Cross-session |
| Workspace Agent | ✅ Bug fixed, prompt autonomous | ✅ Autonomous |

**Progress: 4/7 items selesai atau partial.** Yang belum: Skills system, Memory system, dan full Context compression (image stripping, session rotation).

**Bottom line**: Arunaki punya "tangan" (tools) yang cukup, dan sekarang "otak" (framework) sudah mulai dibangun. Skills system dan memory system adalah langkah berikutnya untuk menjadikan agent benar-benar autonomous.
