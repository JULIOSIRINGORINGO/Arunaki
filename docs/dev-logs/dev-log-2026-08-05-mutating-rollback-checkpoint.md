# Dev Log — Rollback/Checkpoint Multi-Step Mutating Ops (Gap #8)

**Date & Time:** 2026-08-05 11:10 WIB
**Author:** opencode

## What

Gap #8: tidak ada rollback/checkpoint untuk multi-step mutating operations. Sebelumnya, kalau dalam satu putaran LLM merencanakan N mutasi berurutan dan mutasi ke-k gagal, file 1..k-1 tetap berubah — workspace ditinggalkan dalam state inkonsisten.

Diimplementasikan compensating transaction (rekomendasi #2 gap doc, lebih ringan dari snapshot penuh):

- `snapshotFile()` menyimpan isi file target (`args.filename`/`args.path`, di-resolve via rootPath + path isolation check) ke array `checkpoints` SEBELUM loop mutating dimulai.
- Kalau salah satu mutasi di putaran gagal (`result.status === 'error'`), `rollbackSnapshots()` mengembalikan semua file yang disentuh putaran itu ke state sebelum putaran: write-back content lama untuk file yang sudah ada, hapus untuk file yang tadinya tidak ada. Dijalankan maksimal sekali per putaran (`rollbackNotified`).
- User diberi notifikasi jelas via `onEvent({ type: 'error', data: { message: 'Sebagian perubahan dibatalkan otomatis karena ada langkah yang gagal.' } })`.

## Files Changed

- `apps/api/src/modules/workspace/workspace-runner.service.ts`
  - `FileSnapshot` interface baru.
  - Helper `resolveWorkspaceFilePath()`, `snapshotFile()`, `rollbackSnapshots()`.
  - Checkpoint collection sebelum loop `mutatingCalls` + rollback + notifikasi saat mutasi gagal.
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — 2 test baru.
- `WORKFLOW.md` — Phase 45.5.

## Tests

- `npx vitest run src/modules/workspace` — ✅ 9/9 (2 test rollback baru: gagal di mutasi ke-2 → file ke-1 direstore; semua sukses → tidak rollback).
- `npx vitest run src/modules/chat src/modules/tools` — ✅ 29/29.
- `npm run build` — ✅ 0 errors.

## Notes

- Rollback memakai `readBuffer`/`writeBuffer`/`deleteFile` (StorageService) sehingga aman untuk file binary sekalipun.
- Desktop tools (Excel/Word live) tidak bisa di-rollback ke file — ini hanya melindungi workspace file mutations (write/update/delete/rename via `filename`/`path`). Desktop ops tetap dilindungi approval + path isolation.
- Checkpoint dibuang otomatis saat putaran selesai sukses (in-memory, tidak menyentuh disk — tidak ada overhead I/O tambahan di luar read buffer file target).
