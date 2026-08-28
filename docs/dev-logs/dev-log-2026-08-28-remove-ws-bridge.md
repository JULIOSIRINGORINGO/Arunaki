# Dev Log — Remove Dead WebSocket Bridge (MASTER-HARNESS-PLAN Langkah 1)

**Date & Time:** 2026-08-28 13:15:00 WIB
**Author:** opencode AI

## What
Menghapus bridge WebSocket legacy `ws://127.0.0.1:31524` dari Electron
main — langkah pertama konsolidasi single-harness sesuai
docs/MASTER-HARNESS-PLAN.md. Blok `Backend Bridge (WebSocket client)`
(termasuk auto-reconnect + semua handler RPC `openExcel/openWord/screenshot`
dll.) adalah dead code dari era `apps/api` (NestJS) yang backend-nya sudah
dihapus. Preload 100% memakai `ipcRenderer.invoke`, jadi akses native aman.

## Files Changed
- `apps/desktop/main.cjs` — hapus `require('ws')`, seluruh blok WS client +
  handler, `desktopCapturer` (hanya dipakai screenshot via WS). Semua IPC
  native (`dialog:pickFolder`, `fs:*`, `excel:openNative`, `app:*`,
  `theme:set`) tidak tersentuh.
- `apps/desktop/package.json` — hapus dependensi `ws`.
- `WORKFLOW.md` — Phase 32 ditandai REMOVED + catatan migrasi; tambah
  Phase 62.1 (DONE).

## Tests
- `node --check apps/desktop/main.cjs` — ✅ pass (syntax valid).
- Grep `31524`/`connectToBackend` di `apps/*` — ✅ tidak ada match (sisa
  hanya di dokumen catatan historis).
- `npm run build -w apps/web` — menunggu/menjalankan (mandat AGENTS.md).

## Notes
- Tidak ada renderer/pages yang memanggil jalur WS; semua komunikasi native
  via `window.arunakiDesktop.*`.
- Run manual desktop (`npm run dev:app`) disarankan untuk serif final —
  belum dijalankan di sesi ini.