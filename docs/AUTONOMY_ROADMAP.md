# Autonomy Roadmap

Tahapan Arunaki dari sekarang sampai bisa kerja otonom di workspace.

---

## Status: Phase 7 — Advanced Intelligence (Partial)

---

## Phase 1: Foundation ✅ SELESAI

**Goal:** Basic workspace agent yang bisa baca file dan jawab pertanyaan.

| Item | Status |
|------|--------|
| File upload ke workspace | ✅ |
| Baca Excel/CSV/PDF/TXT | ✅ |
| Basic chat dengan AI | ✅ |
| SSE streaming | ✅ |
| Tool system (OpenAI format) | ✅ |
| Generate export (Excel/CSV/PDF) | ✅ |
| Workspace CRUD | ✅ |

**Output:** Agent bisa baca file dan kasih jawaban dasar.

---

## Phase 2: Resilience ✅ SELESAI

**Goal:** Agent yang tidak mudah crash dan handle error dengan baik.

| Item | Status |
|------|--------|
| Token counting (tiktoken) | ✅ |
| Tool result pruning | ✅ |
| History truncation | ✅ |
| Error retry with backoff | ✅ |
| MAX_ROUNDS increased (25) | ✅ |
| Fix workspace system prompt bug | ✅ |

**Output:** Agent bisa handle conversation panjang dan recover dari error.

---

## Phase 3: Agent Intelligence ✅ SELESAI

**Goal:** Agent yang belajar dari pengalaman dan punya memory lintas sesi.

| Item | Status |
|------|--------|
| Skills system (CRUD + search) | ✅ |
| Memory system (CRUD + search) | ✅ |
| Auto-save memory setelah tugas | ✅ |
| Auto-save skill dari workflow | ✅ |
| Workspace prompt updated | ✅ |
| OpenClaw-style prompt architecture | ✅ |
| English prompts (modular files) | ✅ |
| Tool-Use Enforcement rules | ✅ |
| Anti-Fabrication rules | ✅ |
| Verification checklist | ✅ |

**Output:** Agent punya "otak" yang benar — prompts yang enforce, memory yang persist, skills yang reusable.

---

## Phase 4: Rate Limit Resilience ✅ SELESAI

**Goal:** Agent yang bisa handle rate limit dan network error dengan graceful degradation.

| Item | Status |
|------|--------|
| Error classification (retry/rotate/fatal) | ✅ |
| Jittered backoff (decorrelated) | ✅ |
| Credential pool (multi-provider rotation) | ✅ |
| Provider DB-driven configuration | ✅ |
| Cooldown with jittered backoff | ✅ |
| Graceful degradation (skip failed tools) | ✅ |

**Output:** Agent tidak crash saat rate limit. Bisa continue dengan provider rotation.

---

## Phase 5: Context Compression ✅ SELESAI

**Goal:** Agent yang bisa handle workspace sangat besar tanpa kehabisan context.

| Item | Status |
|------|--------|
| 4-phase compression pipeline | ✅ |
| Tool result pruning (keep last 3) | ✅ |
| Image stripping (old images → placeholder) | ✅ |
| Tool pair sanitization | ✅ |
| Token-aware tail protection | ✅ |
| Structured summary generation | ✅ |
| StreamingContextScrubber (security) | ✅ |
| Injection limiting (skills/memory) | ✅ |

**Output:** Agent bisa handle workspace dengan 50+ file tanpa degradasi.

---

## Phase 6: Approval Gate & Transparency ✅ SELESAI

**Goal:** Agent yang minta approval sebelum aksi berbahaya, dan transparan tentang apa yang dilakukan.

| Item | Status |
|------|--------|
| Approval dialog untuk aksi destructive | ✅ |
| Progress indicator di UI (SSE events) | ✅ |
| Step-by-step log di UI | ✅ |
| Domain config system | ✅ |
| Skills-lite (auto-injected) | ✅ |
| Memory frozen snapshot | ✅ |

**Output:** User punya kontrol penuh atas agent. Trust meningkat.

---

## Phase 7: Advanced Intelligence ✅ DONE (Commit 2410c16)

**Goal:** Agent yang benar-benar otonom — bisa rencanakan, eksekusi, dan evaluasi sendiri.

| Item | Status |
|------|--------|
| Planning (agent buat rencana sebelum kerja) | ✅ |
| Background review (auto-learn setiap turn) | ✅ |
| Session search FTS5 (cross-session recall) | ✅ |
| **Autonomous Planner (goal decomposition + reflection)** | ✅ |
| **Self-Healing (auto error recovery + tool fallback)** | ✅ |
| **Workspace Heartbeat (proactive file change detection)** | ✅ |
| **Auto Memory Distillation (compress + deduplicate memories)** | ✅ |
| Self-evaluation (agent cek hasilnya sendiri) | ✅ |
| Skill self-improve (skill update otomatis) | ✅ |
| Smart memory recall (prefetch konteks relevan) | ✅ |
| Background curator (review skills berkala) | ⏳ |

**Output:** Agent belajar dari setiap tugas. Self-evaluation, skill self-improve, dan smart recall berfungsi.

---

## Phase 8: Business Intelligence ⏳

**Goal:** Agent yang punya domain knowledge bisnis Indonesia.

| Item | Status |
|------|--------|
| Domain config (garment/restaurant/retail) | ✅ |
| Template laporan bisnis (RUG, LABA RUGI, NERACA) | ⏳ |
| Knowledge base business rules | ⏳ |
| Smart recommendation engine | ⏳ |
| Anomaly detection (otomatis) | ⏳ |
| Trend analysis (otomatis) | ⏳ |

**Output:** Agent tidak hanya baca data — tapi kasih insight bisnis yang actionable.

---

## Flow Singkat

```
Phase 1: Foundation ✅
    ↓
Phase 2: Resilience ✅
    ↓
Phase 3: Agent Intelligence ✅
    ↓
Phase 4: Rate Limit Resilience ✅
    ↓
Phase 5: Context Compression ✅
    ↓
Phase 6: Approval Gate ✅
    ↓
Phase 7: Advanced Intelligence ⏳  ← SEKARANG
    ↓
Phase 8: Business Intelligence ⏳
    ↓
FULL AUTONOMY 🎯
```

---

## Employee Capability Map

Setiap phase menghasilkan kemampuan karyawan tertentu:

| Phase | Output | Employee Capability |
|-------|--------|-------------------|
| Phase 1 | Baca file, jawab pertanyaan | 📋 Receptionist — terima info, kasih jawaban |
| Phase 2 | Handle error, context panjang | 🛡️ Reliable — tidak mudah crash |
| Phase 3 | Memory + Skills + Prompt | 🧠 Learning — ingat dan belajar |
| Phase 4 | Rate limit resilient | ⏰ Consistent — tetap kerja meski ada gangguan |
| Phase 5 | Context besar + security | 📚 Capable — handle banyak data, aman |
| Phase 6 | Approval + transparency + domain | 🤝 Trustworthy — minta izin, transparan |
| Phase 7 | Planning + self-evaluation | 👔 Professional — rencanakan, verifikasi |
| Phase 8 | Business intelligence | 💼 Expert — kasih insight bisnis |

**Target:** Setelah Phase 8, agent = **karyawan digital yang bisa diandalkan**.

---

## Catatan Penting

1. **Setiap phase harus selesai SEBELUM lanjut ke phase berikutnya**
2. **Testing dilakukan di web UI, bukan terminal**
3. **Workspace = folder bisnis user, bukan seluruh komputer**
4. **Agent tidak pernah akses file di luar workspace**
5. **Rate limit testing butuh OpenRouter credit ($10)**
6. **Agent harus bisa jadi karyawan digital — bukan sekadar tool**
7. **Lihat docs/EMPLOYEE_FRAMEWORK.md untuk detail kemampuan karyawan**
