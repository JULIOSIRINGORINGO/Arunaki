# Dev Log — Fix Desktop Bridge Env & Chat Input

**Date & Time:** 2026-08-03 00:55:00 WIB
**Author:** Antigravity

## What
- Memperbaiki masalah `Unauthorized` pada koneksi Desktop Bridge (Electron) dengan membaca file `.env` secara manual di `main.cjs`.
- Membuat dokumentasi masalah Naive Append Bias di `ISSUE-TEMPORAL-REASONING.md`.
- Memperbarui komponen `ChatInputForm` di `WorkspacePage.tsx` menjadi `textarea` yang ukurannya menyesuaikan secara otomatis.

## Files Changed
- `apps/desktop/main.cjs` — Menambahkan parser `.env` manual.
- `docs/ISSUE-TEMPORAL-REASONING.md` — Pembuatan dokumen analisis.
- `apps/web/src/pages/WorkspacePage.tsx` — Mengganti `input` menjadi `textarea` pada chat UI.
- `scripts/dev-app.cjs` — Pembaruan minor dari task sebelumnya.

## Tests
- Koneksi Desktop ke Backend berhasil tanpa error "Unauthorized".
- Input Chat di UI bisa membesar secara otomatis tanpa terkunci besarnya.
- ✅ passed

## Notes
- Sesuai instruksi, `REKAPAN TERBARU2.txt` (dan variasinya) serta script `add-kenari.ts` **diabaikan (ignored)** dan tidak di-commit.
