# Reverse Engineering Hermes Agent

Document ini mencatat semua yang diambil dari Hermes Agent, bagaimana diadaptasi ke Arunaki, dan apa yang TIDAK diambil.

---

## Sumber

- **Hermes Agent** (dahulu OpenClaw): `https://github.com/NousResearch/hermes-agent`
- **hermes-telegram-business**: Hanya bot Telegram sekretaris, BUKAN business analysis system
- Analisis dilakukan: 27 Juli 2026

---

## 1. Yang Diambil & Diadaptasi

### 1.1 Prompt Architecture

| Hermes | Arunaki | Catatan |
|--------|---------|---------|
| `SOUL.md` — agent identity | `identity.md` | Diubah dari "coding assistant" ke "business specialist" |
| `RULES.md` — enforcement language | `rules.md` | Persis sama: MUST, NEVER, MANDATORY |
| `WORKSPACE.md` — workspace rules | `workspace-rules.md` | Diadaptasi untuk web UI, bukan terminal |
| `TOOLS.md` — tool guidance | `workspace-flow.md` | Tool list disesuaikan (24 tools vs 45) |
| `USER.md` — user context | `memory-context.md` | Diadaptasi ke database persistence, bukan file |
| Modular file loading | `loadPrompt()` di `ai.service.ts` | Persis sama konsepnya: baca `.md` files |

**Prinsip yang diambil:**
- English prompts lebih precise untuk LLM
- Enforcement language (MUST/NEVER) lebih efektif dari permissive language
- Modular files lebih mudah di-maintain dari inline string
- Anti-fabrication rules kritis untuk model lemah

### 1.2 Agent Intelligence

| Hermes | Arunaki | Status |
|--------|---------|--------|
| Skills system (CRUD + auto-create) | `SkillModel` + `SkillsTool` | ✅ Done |
| Memory system (persistence) | `MemoryModel` + `MemoryTool` | ✅ Done |
| Auto-save after tasks | `workspace-runner.service.ts` | ✅ Done |
| Progressive disclosure (list→view→use) | `list_skills` → `view_skill` | ✅ Done |

### 1.3 Context Management

| Hermes | Arunaki | Status |
|--------|---------|--------|
| Token counting | `tiktoken` integration | ✅ Done |
| Tool result pruning | `pruneToolResults()` | ✅ Done |
| History truncation | `truncateHistory()` | ✅ Done |
| Error retry with backoff | `fetchWithRetry()` | ✅ Done |

---

## 2. Yang TIDAK Diambil (Dan Mengapa)

| Hermes Feature | Alasan Tidak Diambil |
|---|---|
| **Terminal access** | Arunaki = web UI, bukan CLI. User tidak punya terminal di browser. |
| **File system access (full)** | Arunaki hanya akses workspace, bukan seluruh komputer. |
| **Telegram/Discord integration** | Arunaki = web-only. Tidak multi-platform. |
| **Sub-agent delegation** | Terlalu kompleks untuk phase sekarang. Deferred. |
| **Parallel tool execution** | Sequential lebih aman untuk approval gate. |
| **Credential pool** | Butuh $10 OpenRouter credit untuk test. Deferred. |
| **Error classifier (73KB)** | Terlalu besar. Basic retry sudah cukup untuk sekarang. |
| **Skills Hub (community sharing)** | Out of scope. Arunaki = single-tenant. |
| **Background curator** | Over-engineering untuk phase sekarang. |
| **Prompt injection scanning** | Belum prioritas. |
| **Image stripping** | Context compression partial sudah cukup. |
| **SQLite compression lock** | Tidak perlu untuk single-user web app. |
| **Per-model guidance** | Tidak ada model switching di Arunaki. |
| **Context files auto-discover** | Arunaki pakai explicit config, bukan auto-discover. |
| **Streaming + continuation** | SSE basic sudah ada. |
| **Budget management** | Fixed MAX_ROUNDS sudah cukup. |

---

## 3. Adaptasi untuk Web UI

Hermes dirancang untuk terminal/CLI. Arunaki harus adaptasi:

| Aspek | Hermes (Terminal) | Arunaki (Web UI) |
|---|---|---|
| **User input** | Terminal command | Text input di browser |
| **File access** | Full file system (`~/.openclaw/`) | Hanya workspace folder |
| **Output** | Terminal stdout | Canvas panel + markdown |
| **Progress** | Terminal logs | SSE stream ke UI |
| **Approval** | CLI confirmation | Modal dialog di UI |
| **File upload** | Drag-drop ke terminal | File upload dialog |
| **Export** | Save to any path | Download via browser |
| **Platform** | Multi-platform (Telegram, Discord, etc) | Web only |

---

## 4. Kesimpulan

Arunaki mengambil **inti** dari Hermes Agent:
1. Prompt architecture yang well-crafted
2. Tool-use enforcement yang ketat
3. Skills + Memory untuk learning
4. Context management untuk model lemah

Arunaki **TIDAK** mengambil:
1. Terminal/file system access
2. Multi-platform integration
3. Sub-agent delegation
4. Community features

**Prinsip:** Reverse engineer the intelligence, not the interface.
