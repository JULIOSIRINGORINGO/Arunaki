# Dev Log — Restore Engine Boot Path for Electron

**Date & Time:** 2026-08-28 11:30:00 WIB
**Author:** opencode AI

## What
Memperbaiki rantai koneksi Electron→Backend→LLM. Ditemukan `scripts/dev-app.cjs`
mereferensikan entrypoint `packages/engine/opencode/src/serve-only.ts` yang TIDAK
ada, sehingga `npm run dev:app` gagal di langkah 1 dan engine tidak pernah
listen di `:4096` → UI Electron tidak bisa chat/berinteraksi API.

## Files Changed
- `packages/engine/opencode/src/serve-only.ts` — BARU: entrypoint headless
  minimal yang meniru `index.ts` tetapi hanya mendaftarkan `ServeCommand`
  (yargs + environment setup yang sama: Arunaki_PID, Heap.start, AGENT/Arunaki).
- `WORKFLOW.md` — Phase 61.7 (DONE) dengan ringkasan diagnosa rantai koneksi.

## Hasil Diagnosa (terverifikasi)
- Electron → Web UI :5173 → Vite proxy `/api` → engine `:4096` → event `SSE /api/event`.
- Semua endpoint yang dipakai web (`/api/session`, `/api/provider`, `/api/agent`,
  `/api/model`, `/api/health`) ADA di `packages/engine/protocol/src/groups/*`.
- Auth: tanpa `Arunaki_SERVER_PASSWORD` (tidak ada `.env`) engine tidak minta auth.
- `ws://127.0.0.1:31524` di `main.cjs` = legacy dead code (backend `apps/api` sudah dihapus).

## Tests
- Boot nyata: `bun run --conditions=browser ./src/serve-only.ts serve --port 4096`
  → `Arunaki server listening on http://127.0.0.1:4096` ✅
- `GET /api/health` → HTTP 200 `{"healthy":true}` ✅
- `bun run typecheck` (engine) — tidak ada error baru dari `serve-only.ts`;
  sisa error pre-existing `@opentui/*` & `@Arunaki-ai/http-recorder`.

## Notes
- WS legacy `:31524` sengaja dibiarkan (tidak melebar); akan dibersihkan saat
  finalisasi MASTER PROMPT single-harness (.exe di-defer sesuai permintaan user).
- Selanjutnya: verifikasi E2E chat dari Electron (prompt → turn → persist), lalu
  tulis deliverable MASTER PROMPT (mapping bridge, target structure, step-by-step).