# Perbandingan Arunaki vs OpenClaw

**Date:** 2026-07-31
**Source:** 3-agent deep-dive of `E:\JS\OpenClaw\openclaw-repo` + Arunaki codebase trace

---

## 1. Konteks Percakapan (beda terbesar)

| | OpenClaw | Arunaki |
|---|---|---|
| Setiap LLM call | Resend **seluruh transcript** (system + user + assistant + tool results) | Workspace agent kirim `{goal}` saja — **tanpa history** |
| Alasan | Model bisa melihat apa yang sudah terjadi, nama file yang dibuat, keputusan sebelumnya | Model buta — tidak tahu "file itu" apa, tidak ingat typo sebelumnya |

OpenClaw: `packages/agent-core/src/agent-loop.ts` — `convertToLlm` membangun array messages `role=user` setiap pesan history.

Arunaki (sebelum fix ini): controller fallback `historyMessages: [{user: goal}]` — 1 pesan saja.

---

## 2. System Prompt

| | OpenClaw | Arunaki |
|---|---|---|
| Isi | 700+ baris: identity, **Tooling summaries**, **Memory section**, **Project Context** (AGENTS.md/SOUL/IDENTITY/USER/MEMORY di-inject literal), **Temporal Context** (tanggal/timezone) | Prompt kerja, aturan dasar, daftar tool — lebih pendek. Tidak ada project context injection. |
| Cache | Stable prefix vs volatile suffix dipisah (cache boundary :1381) | Satu prompt, tidak ada pemisahan |

OpenClaw: `src/agents/system-prompt.ts:754` — system prompt = identity + Tooling summaries + Memory + Project Context + per-turn volatile data.

---

## 3. Loop Eksekusi

| | OpenClaw | Arunaki |
|---|---|---|
| Setelah tool sukses | Model konsumsi hasil tool → putaran berikutnya dipanggil lagi → model menghasilkan **jawaban final** berupa teks natural | Loop `break` langsung saat `write_workspace_file` atau `delete_workspace_file` sukses → model tidak pernah bicara |
| Pesan user diakhiri | Teks natural: "File `test format text.txt` berhasil dibuat. Di dalamnya saya menulis..." | Template: "Berkas **test pormat text.txt** berhasil dibuat/disunting" |

Arunaki punya guard `fileWritten` di `workspace-runner.service.ts:1108-1110` yang sengaja diputuskan (keputusan speed). OpenClaw tidak pernah membunuh loop sendiri.

---

## 4. Tracking State File

| | OpenClaw | Arunaki |
|---|---|---|
| Antara turn | Kompaksi mengekstrak `modifiedFiles`, `readFiles` dari tool calls → disimpan sebagai tag summary | Tidak ada file state antar-turn (sebelum 99fbdfb). Setelah 99fbdfb: auto-save workspace history memory memberikan partial mitigation. |
| Pronoun resolution | Model lihat transcript → tahu "file itu" = file yang baru dibuat di turn sebelumnya | Model tidak punya konteks → pronoun hard-rejected oleh tools (`AMBIGUOUS_FILENAME`) |

---

## 5. Memory/Persistensi

| | OpenClaw | Arunaki |
|---|---|---|
| Faktual memory | LLM menulis fakta ke `memory/YYYY-MM-DD.md` via tool khusus di setiap run; system prompt memerintahkan `memory_search` untuk recall per query | `auto-memory.service.ts` menyimpan workspace state → di-recall via `smartRecallService.recall()` per run |
| Recall | Per LLM call (di system prompt memory section) | Per run (di-inject via context registry) |
| Cakupan | Seluruh riwayat pekerjaan | Workspace saja |

---

## 6. Kompaksi Konteks

| | OpenClaw | Arunaki |
|---|---|---|
| Strategi | Rolling summary: LLM menghasilkan summary ringkas → menjadi user-role message dalam compacted history → wrapper tags `<<<summary>>>` | Utility-based: saat >20 messages, panggil `compactionService.compactHistory()`, potong, simpan pesan terkompaksi |
| Kualitas | Model menulis summary sendiri → konteks lebih kaya | Kompaksi mekanis, bukan LLM reasoning |

---

## 7. Planning / Reasoning

| | OpenClaw | Arunaki (sebelum 2fb3f2b) |
|---|---|---|
| Planning per aksi | LLM reasoning alami dalam loop | Regex shortcut `isWriteIntent`/`isDeleteIntent` mem-bypass LLM → langsung eksekusi |
| Masalah regex | — | "test pormat text" typo tidak pernah dikoreksi karena model tidak dilibatkan |

Sekarang (2fb3f2b): regex shortcuts dihapus, 100% LLM Function Calling. Tapi memory/context gap tetap ada (karena web tidak kirim history).

---

## 8. Tool Result Feedback

| | OpenClaw | Arunaki |
|---|---|---|
| Format | Tool results di-format rapi, di-feedback ke model dalam conversation | Sama (`ToolResultFormatter`), TAPI model sering tidak melihatnya karena loop break |

---

## Kesimpulan: 3 Alasan Utama LLM Arunaki Terasa Bodoh

1. **Stateless per-request** — model tidak pernah melihat apa yang terjadi di turn sebelumnya. Ini masalah nomor 1, dan sekarang sudah diperbaiki (historyMessages dikirim).
2. **Loop break prematur** — model tidak pernah mendapat kesempatan bicara setelah eksekusi tool (hanya mendapat template response).
3. **Tidak ada structured file tracking** — model tidak punya ringkasan "file apa yang baru dibuat/diubah" antar turn.

---

## Fix yang Sudah Diterapkan

| # | Fix | Status |
|---|---|---|
| 1 | Web kirim `historyMessages` dari session state ke API | ✅ Done (commit `e97cfe9`) |
| 2 | `lastMutatedFile` state tracking | Dilewati (auto-save memory + fuzzy resolution di tools sudah memberikan partial coverage; revisit jika masalah berlanjut) |
| 3 | Jangan break loop setelah write (biarkan LLM bicara final) | Tidak diubah (deliberate speed trade-off oleh Antigravity, `99fbdfb`) |
| 4 | Pronoun resolution di tool layer | ✅ Done (commit `99fbdfb` — fuzzy matching + AMBIGUOUS_FILENAME fallback) |

---

## Remaining Risks

- **Loop break setelah write**: model tidak pernah bilang "Here's what I did" secara natural. Template messages cukup untuk UX tapi mengurangi perceived intelligence. Kalau user mau model memberi final natural summary, hapus `fileWritten` break di `workspace-runner.service.ts:1098-1110`.
- **Tidak ada structured file state antar turn**: OpenClaw tracks modified/read files di compaction summaries. Arunaki mengandalkan auto-save memory untuk ini.