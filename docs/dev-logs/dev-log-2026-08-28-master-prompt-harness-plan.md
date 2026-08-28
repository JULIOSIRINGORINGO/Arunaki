# Dev Log — MASTER PROMPT Single Harness Consolidation Plan

**Date & Time:** 2026-08-28 12:30:00 WIB
**Author:** opencode AI

## What
Menghasilkan deliverable MASTER PROMPT (Modul 1-3): mapping jalur/modul &
bridge yang diputus, target structure & data flow baru, dan step-by-step
action plan untuk konsolidasi Arunaki menjadi single harness. .exe di-defer
sesuai instruksi user.

## Files Changed
- `docs/MASTER-HARNESS-PLAN.md` — BARU: deliverable lengkap (topologi saat
  ini, daftar bridge yang diputus, target single-harness, 6 langkah rencana,
  keputusan yang perlu dikonfirmasi tim).
- `WORKFLOW.md` — Phase 61.9 (DONE) ringkasan deliverable + temuan kunci.

## Key Findings
- `Server.Default()` (`server/server.ts:56`) menyediakan handler **in-process**
  (`app.fetch`) — memungkinkan UI↔Engine satu proses tanpa port TCP.
- `script/build.ts:26-48` (`createEmbeddedWebUIBundle`) membangun web UI dari
  `packages/engine/app` (web bawaan OpenCode), **bukan `apps/web`** — perlu
  dialihkan saat embed UI produk.
- `ws://127.0.0.1:31524` di `main.cjs:455` = dead (apps/api dihapus); handler
  WS RPC (openExcel/openWord/excelEdit/wordType/dll) redundan/redup.

## Tests
- Tidak ada perubahan kode — dokumen & checklist saja.
- (E2E engine sudah dibuktikan sebelumnya: health/session/prompt/message 200.)

## Notes / Open Questions (butuh keputusan tim)
1. Definisi "hilangkan local HTTP": zero-TCP (protocol handler) vs listener
   loopback transisi?
2. UI resmi produk = `apps/web` (rekomendasi).
3. Native OS bridge (COM office via `arunakiDesktop`) dianggap sah sebagai
   integrasi aplikasi desktop, bukan bridge ke engine.

## Next Steps
- Eksekusi Langkah 1 (buang WS dead bridge di main.cjs) mulai sesi berikutnya.
- Keputusan tim pada ADR transport in-process sebelum Langkah 2.