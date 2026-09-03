# Dev Log — Sentinel Step.Ended Wiring di Jalur Produksi (httpapi)

**Date & Time:** 2026-09-03 18:00 WIB
**Author:** AI Software Engineer (opencode)

## What

Memperbaiki **kain (latent bug)** di jalur produksi httpapi: sentinel
`Memory` (auto-learn koreksi user ke `.arunaki/ARUNAKI.md`) **tidak pernah
menerima `SessionEvent.Step.Ended`** karena engine prompt loop (`prompt.ts`)
tidak mem-publish event tersebut — hanya core runner yang publish di jalurnya
sendiri. Akibatnya koreksi user tidak otomatis masuk ke ARUNAKI.md saat
memakai engine melalui HTTP API.

Perbaikan = **Opsi 1** (disetujui user): hanya **menambah** publish event,
tanpa mengubah fungsi existing. Dibuktikan end-to-end di report-folder
`E:\JS\laporan-test` via httpapi bahwa koreksi user masuk ke ARUNAKI.md.

## Files Changed

- `packages/engine/engine/src/session/prompt.ts` — publish
  `SessionEvent.Step.Ended` di titik turn-completion prompt loop; `timestamp:
  yield* DateTime.now` (harus `DateTime.Utc`, bukan `Date.now()` number karena
  EventV2 memvalidasi data saat publish); **blocking** (bukan
  `Effect.forkIn(scope)`, karena fork ikut di-interrupt saat scope prompt
  menutup sehingga event tak pernah dikirim). Payload dari `lastAssistant.info`
  (`assistantMessageID`, `finish`, `cost`, `tokens`). Tambah import `DateTime`
  dan `SessionEvent`.
- `packages/engine/engine/src/arunaki/memory.ts` — tambah `Memory.ensureActive()`
  (materialize instance state per-folder supaya subscription
  `SessionEvent.Step.Ended` ter-attach tanpa rewrite ARUNAKI.md).
- `packages/engine/engine/src/project/bootstrap.ts` — panggil
  `memory.ensureActive()` di instance bootstrap (failure-tolerant via
  `catchCause`); tambah `Memory.node` ke deps.
- `WORKFLOW.md` — tambah note update (Phase 50, kedua blok duplikat).

## Tests / Verification

- E2E via httpapi (engine `serve --port 4096` dari `src/index.ts`, laporan-test,
  model `kenari/mimo-v2-5:free`):
  - `POST /session?directory=E:/JS/laporan-test` → 200
  - `POST /session/{id}/message` (pesan koreksi) → 200
  - `.arunaki/ARUNAKI.md` berakhir `### Learned by the Sentinel` berisi aturan
    tepat = pesan koreksi user
  - `.arunaki/user-corrections.jsonl` ter-append baris koreksi
  - Jalur: `prompt.ts publish` → `Memory.onTurnCompleted` → `learnCorrection`
    → `applyCorrections` + append jsonl — ✅ passed
- `npm run build -w apps/web` (`tsc -b && vite build`) — ✅ 0 error TS
  (mandatory build verification, AGENTS.md rule 5).
- Keterangan akar masalah yang ditemukan selama diagnosa:
  - fork `Effect.forkIn(scope)` → event hilang (scope tutup sebelum kirim)
  - `timestamp: Date.now()` → error validasi `Expected DateTime.Utc, got <millis>`

## Notes

- Instrumentasi diagnostik sementara (`memdiag` di `memory.ts`) sudah dihapus
  seluruhnya setelah bukti didapat.
- Artefak E2E & `E:\JS\laporan-test\arunaki.json` (berisi API key) sudah
  dihapus dari disk.
- `git status --porcelain` bersih = hanya 3 file source yang diubah
  (memory.ts, bootstrap.ts, prompt.ts).
- Latency publish blocking bisa bertambah sedikit; jika terbukti mengganggu,
  upgrade path = kirim via background tanpa kehilangan scope (mis. daemon
  queue), bukan memakai `forkIn(scope)`.
