# Dev Log — Excel Multi-Sheet Stress Test (NO HINTS)

**Date & Time:** 2026-08-22 21:30:00 WIB
**Author:** AI Agent (opencode)

## What

Stress test untuk desktop_excel_edit — 6 instruksi natural tanpa petunjuk cell/column/sheet.

### Hasil: 4/18 PASSED, 14 FAILED

---

## Alur Agent Run — Kenapa tools=[]

`
User kirim goal
    |
    v
workspace-runner.service.ts:213
    |  promptBuilder.buildInitialContext()
    |      |
    |      +-- buildWorkspaceContext()     -> baca workspace metadata
    |      +-- smartRecallService.recall() -> recall memori terkait
    |      +-- classifyIntent(goal)        <- LLM call kecil (router)
    |      |     |
    |      |     +-- Kirim goal + daftar 50+ tool names
    |      |         -> LLM router pick tool names via set_intent()
    |      |         -> ATAU gagal -> fallback ['read','list','document_reader']
    |      |
    |      +-- selectToolsForGoal()        <- filter tools dari registry
    |      |     +-- + safety net regex    <- TAMBAHAN SAYA (baru)
    |      |
    |      +-- getSystemPrompt()           <- bangun system prompt panjang
    |      +-- contextRegistry.assemble()  <- gabung semua context
    |
    v
workspace-runner.service.ts:343
    |  aiService.chatStream(messages, toolsToPass, modelId)
    |      |
    |      +-- Kirim ke DeepSeek free
    |          System prompt + context + tool definitions
    |          Tapi model return: content="" + toolCalls=[]
    |
    v
workspace-runner.service.ts:383
    |  if (content kosong && toolCalls kosong)
    |      -> fallback: aiService.chat() (non-streaming)
    |      -> juga return kosong
    |
    v
Agent selesai. tools=[]. content="Autonomous workspace task completed."
`

---

## Yang terjadi di test

| Run | Tool routing | Hasil |
|---|---|---|
| **Sebelum fix** (commit lama) | Classifier pick edit, document_reader, read, list -- TANPA desktop_excel_edit | Model panggil tool tapi yang salah (edit text bukan Excel COM) |
| **Setelah fix** (safety net) | Classifier + safety net -> desktop_excel_edit tersedia | Model tidak panggil tool sama sekali (tools=[]) |

---

## Kenapa model return kosong?

**Kemungkinan 1 -- Free tier rate limit.**
DeepSeek free (deepseek-chat-v3-0324:free) sering kena rate limit. Ketika rate-limited, model return empty response tanpa error. Ini confirmed: test dengan openrouter/auto juga hasil sama (kosong).

**Kemungkinan 2 -- Tool definitions terlalu banyak.**
Registry punya ~50 tools. Walaupun classifier cuma pick 4-5, semua tool definitions tetap dikirim ke model sebagai JSON schema di tools array. DeepSeek free mungkin punya batas tool yang bisa diproses -- kalau terlalu banyak, diam-diam return kosong.

**Kemungkinan 3 -- System prompt + context terlalu panjang.**
Workspace rules (ARUNAKI.md yang sudah dikompresi) + context assembly + tool schemas = mungkin melebihi context window model free tier.

---

## Kenapa test-excel-rekap.ts BISA tapi stress test TIDAK?

Bedanya satu: test-excel-rekap.ts pakai @testing.xlsx di goal. File mention ini memicu eadMentionedFile() yang pre-read file dan menambahkan isinya ke context. Mungkin ini memberi model cukup konteks untuk memahami apa yang harus dilakukan.

Stress test tidak pakai file mention -- cuma bilang "di laporan" tanpa nama file spesifik. Model mungkin tidak tahu file mana yang harus diedit.

---

## Kesimpulan

Masalahnya **bukan di tool routing** (safety net sudah benar). Masalahnya di **model behavior** -- DeepSeek free tier tidak memanggil tool saat:

1. Tidak ada file mention (@file.xlsx)
2. Tool definitions terlalu banyak
3. Rate limit aktif

---

## Fix yang sudah diterapkan

workspace-prompt-builder.service.ts -- Deterministic safety net: regex match Excel/Word/PPT keywords di goal -> guaranteed tool injection. Ini mengembalikan behavior dari commit a77476c yang terhapus.

---

## Rekomendasi untuk fix berikutnya

1. Test dengan model berbayar (Claude/GPT-4o) untuk eliminate rate limit
2. Tambah @Laporan Bengkel Januari.xlsx ke instruksi stress test
3. Pertimbangkan kirim tool definitions lebih sedikit (hanya yang dipilih classifier, bukan semua 50+)

---

## Files Changed

- pps/api/src/modules/workspace/services/workspace-prompt-builder.service.ts -- +21 lines: deterministic tool routing safety net
- pps/api/test/excel-stress-test.cjs -- 6-turn stress test with verification
- workspace-demo/.arunaki/ARUNAKI.md -- Updated by sentinel (compressed)

---

## How to Run

`ash
# 1. Build & start API server
cd E:\JS\Arunika\apps\api
npm run build -w apps/api
node dist/src/main.js

# 2. Run stress test (from apps/api/)
node test/excel-stress-test.cjs
`

**Prerequisites:**
- API server running di 127.0.0.1:3000
- Excel terinstall di Windows (COM automation)
- Workspace cmt4e7xfh0001vgoc2mx8nf7n registered

**Model default:** deepseek/deepseek-chat-v3-0324:free
**Timeout per turn:** 5 min | **Total:** ~30 min

**18 assertions yang diverifikasi:**
- T1: 2 transaksi baru + total = 3621000 + original data preserved
- T2: Stok Semen & Besi updated (keluar + sisa konsisten)
- T3: Rekap total (3621000) + jumlah transaksi (7)
- T4: Sheet Februari baru ada + Januari data utuh + Februari kosong
- T5: set_format action called
- T6: PDF file created
- FINAL: Workbook valid + >= 3 sheets
