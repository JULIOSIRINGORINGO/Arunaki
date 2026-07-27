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
│  │ (flat blob)  │  │ ❌ TIDAK ADA         │  │
│  │ No memory    │  └──────────────────────┘  │
│  │ across       │  ┌──────────────────────┐  │
│  │ sessions     │  │ Context Management   │  │
│  └─────────────┘  │ ❌ TIDAK ADA          │  │
│                   └──────────────────────┘  │
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
| **Error handling** | 73KB error classifier, 7 kategori | Try-catch generik |
| **Retry** | Adaptive backoff + jittered wait | ❌ Tidak ada |
| **Credential pool** | API key rotation + failover | 1 API key statis |
| **Context compression** | Multi-path (pre-API, overflow, post-tool) | ❌ Tidak ada |
| **Parallel tools** | ThreadPoolExecutor untuk tools independen | Sequential selalu |
| **Interrupt & redirect** | User bisa interupsi mid-execution | ❌ Tidak ada |
| **Sub-agent delegation** | Spawn isolated child agents | ❌ Tidak ada |
| **Stream handling** | Streaming + continuation prompts | SSE basic |
| **Budget management** | Shared iteration budget parent+child | Fixed MAX_ROUNDS |

**Kesimpulan**: Agent loop Arunaki sangat basic. Tidak ada error recovery, tidak ada context management, tidak ada parallel execution. Ini yang bikin agent "gampang macet".

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
| **Existence** | ✅ Full skills system | ❌ TIDAK ADA |
| **Auto-create** | Agent bisa buat skill dari pengalaman | ❌ |
| **Self-improve** | Skill patch otomatis saat outdated | ❌ |
| **Progressive disclosure** | 3-tier (list → view → files) | ❌ |
| **Background review** | Curator review tiap 7 hari | ❌ |
| **Skills Hub** | Share skills dengan komunitas | ❌ |
| **Security** | Injection scanning, write approval | ❌ |

**Kesimpulan**: Skills system adalah **killer feature** Hermes Agent yang Arunaki TIDAK ADA sama sekali. Ini yang bikin agent bisa "belajar" dan memperbaiki workflow-nya sendiri.

### 2.5 Memory System

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **Existence** | ✅ Full memory system | ❌ TIDAK ADA |
| **Persistence** | MEMORY.md + USER.md + external providers | Knowledge base (flat) |
| **Cross-session** | ✅ Ingat di semua sesi | ❌ Per-chat only |
| **Provider abstraction** | ABC interface, bisa plug provider apapun | ❌ |
| **Context fencing** | XML tags, injection prevention | ❌ |
| **Prefetch** | Background recall sebelum turn | ❌ |
| **Sync** | Background thread, serialized writes | ❌ |

**Kesimpulan**: Memory system Arunaki = knowledge base yang di-inject ke system prompt. Tidak ada persistensi silang sesi, tidak ada user profiling, tidak ada intelligent recall.

### 2.6 Context Management

| Aspek | Hermes Agent | Arunaki |
|-------|-------------|---------|
| **Token counting** | ✅ Hitung token sebelum API call | ❌ Tidak ada |
| **Compression** | Multi-path: pre-API, overflow, post-tool | ❌ Tidak ada |
| **Message pruning** | Tool results diganti placeholder | ❌ Tidak ada |
| **History truncation** | Sliding window + summarization | ❌ Kirim semua history |
| **Image stripping** | Old images diganti placeholder | ❌ |
| **Session rotation** | New session saat compress | ❌ |
| **Lock safety** | SQLite compression lock | ❌ |

**Kesimpulan**: Context management Arunaki = **TIDAK ADA**. Ini masalah kritis. Semua history dikirim ke LLM tanpa batas. Tool results yang besar akan cepat exceeds context window.

---

## 3. BUG KRITIS: Workspace Mode Tidak Pernah Aktif

### Masalah

Di `workspace-runner.service.ts` line 66:
```typescript
const systemPrompt = this.aiService.getSystemPrompt('workspace', undefined, workspaceContext);
```

Parameter `workspaceContext` dikirim ke posisi ke-3 (`knowledgeContext`), bukan posisi ke-2 (`workspaceContext`).

Di `ai.service.ts` line 177:
```typescript
if (mode === 'workspace' && workspaceContext) {  // workspaceContext = undefined!
```

Karena `workspaceContext` (posisi 2) = `undefined`, condition selalu `false`. Workspace mode **jatuh ke chat prompt**, bukan autonomous agent prompt.

### Dampak
- Workspace agent selalu dapat system prompt chat mode (bukan autonomous)
- File listing di-inject sebagai "knowledge base" bukan sebagai workspace context
- Agent tidak punya panduan autonomous yang benar

### Fix
```typescript
// workspace-runner.service.ts
const systemPrompt = this.aiService.getSystemPrompt('workspace', workspaceContext);

// ai.service.ts
getSystemPrompt(
  mode: 'chat' | 'workspace',
  contextOrWorkspace?: string,  // rename parameter
  knowledgeContext?: string,
)
```

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

1. **Fix workspace system prompt bug** — parameter posisi
2. **Token counting** — hitung token sebelum API call, handle overflow
3. **History truncation** — sliding window, jangan kirim semua history
4. **Tool result pruning** — compress large tool results
5. **Error retry** — minimal retry 1-2x untuk transient errors
6. **Parallel tool execution** — tools independen bisa jalan bersama

### Prioritas 2: Agent Intelligence (Minggu 3-4)

1. **Skills system (basic)**
   - Simpan workflow yang berhasil sebagai "skill"
   - Saat workspace baru, cek apakah ada skill yang relevan
   - Agent bisa create skill baru dari pengalaman

2. **Context compression**
   - Summary lama percakapan
   - Prune tool results yang sudah tua
   - Protect system prompt + recent messages

3. **Memory (basic)**
   - Simpan user preferences
   - Ingat workspace yang pernah dikerjakan
   - Cross-session recall

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
| System Prompt | ❌ Flat, no tiers | ✅ 3-tier |
| Agent Loop | ❌ Basic, no error handling | ✅ Resilient |
| Context Management | ❌ Tidak ada | ✅ Full compression |
| Skills System | ❌ Tidak ada | ✅ Auto-learn |
| Memory System | ❌ Tidak ada | ✅ Cross-session |
| Workspace Agent | ❌ Bug, prompt salah | ✅ Autonomous |

**Bottom line**: Arunaki punya "tangan" (tools) yang cukup, tapi kurang "otak" (framework). Fix framework-nya, dan model gratisan pun bisa kerja autonomous.
