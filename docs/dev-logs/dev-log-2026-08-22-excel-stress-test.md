# Dev Log — Excel Multi-Sheet Stress Test (NO HINTS)

**Date & Time:** 2026-08-22 21:30:00 WIB
**Author:** AI Agent (opencode)

## What

Stress test untuk desktop_excel_edit — 6 instruksi natural tanpa petunjuk cell/column/sheet.

### Hasil: 4/18 PASSED, 14 FAILED

Root cause: Agent runner mengembalikan kosong (tools=[], content="") di semua 6 turn. Bukan masalah model (tested deepseek + openrouter/auto sama hasilnya). Bukan masalah tool routing (safety net sudah ditambah). Kemungkinan besar agent runner flow atau model free tier rate-limited.

### Fix yang sudah diterapkan

workspace-prompt-builder.service.ts — Deterministic safety net: regex match Excel/Word/PPT keywords di goal → guaranteed tool injection. Ini mengembalikan behavior dari commit a77476c yang terhapus.

### Follow-up yang perlu dilakukan

1. Investigasi kenapa agent runner tidak menjalankan LLM call (tools=[] berarti LLM tidak dipanggil atau response kosong)
2. Test dengan model berbayar (Claude/GPT-4o) untuk eliminate rate limit issue
3. Test dengan @file.xlsx mention — sebelumnya test-excel-rekap.ts berhasil (11/11) karena pakai @testing.xlsx

## Files Changed

- pps/api/src/modules/workspace/services/workspace-prompt-builder.service.ts — +21 lines: deterministic tool routing safety net
- pps/api/test/excel-stress-test.cjs — 6-turn stress test with verification
- workspace-demo/.arunaki/ARUNAKI.md — Updated by sentinel (compressed)

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
