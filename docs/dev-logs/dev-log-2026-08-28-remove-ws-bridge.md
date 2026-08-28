# Dev Log — MASTER-HARNESS-PLAN: bun-runtime finding + doc update

**Date & Time:** 2026-08-28 14:00:00 WIB
**Author:** opencode AI

## What
Menyelesaikan Langkah 1 MASTER-HARNESS-PLAN (buang dead WS bridge) dan
mendokumentasikan temuan arsitektur yang memblokir Langkah 2-4.

## What / Files Changed
- `apps/desktop/main.cjs` — hapus seluruh blok WebSocket client + handler RPC
  (`require('ws')`, `connectToBackend`, `openExcel/openWord/screenshot/dll`),
  hapus `desktopCapturer` dari require Electron.
- `apps/desktop/package.json` — hapus dependensi `ws`.
- `docs/MASTER-HARNESS-PLAN.md` — Langkah 1 ditandai DONE; tambah "Temuan
  Kunci" (engine tidak bisa di-load di proses Electron karena deps native bun;
  in-process hanya via binary bun-compiled yang di-defer).
- `WORKFLOW.md` — Phase 32 ditandai REMOVED; tambah Phase 62.1 (DONE) +
  62.2 follow-up bun-runtime finding.

## Tests
- `node --check apps/desktop/main.cjs` — ✅
- grep `31524`/`connectToBackend` di `apps/*` — tidak ada match.
- `npm run build -w apps/web` — ✅ 0 error.
- renderer tidak memanggil channel WS yang dihapus (`grep arunakiDesktop.(openExcel|onWord|...)`) — tidak ada match.

## Notes
- Temuan: `Server.Default()` in-process hanya realistis di binary
  `Bun.build` (engine memakai `@ff-labs/fff-bun`, `@parcel/watcher`,
  `@opentui` yang tidak bisa di-load di Node CJS Electron). Langkah 2-4
  bergantung pada harness .exe yang di-defer — dev flow serve-only + Vite
  proxy :4096 tetap jalur transisi yang sah.
- Contoh tantangan masa depan: `script/build.ts:28` harus dialihkan
  dari `packages/engine/app` (tidak ada) ke `apps/web` saat harness dikerjakan.