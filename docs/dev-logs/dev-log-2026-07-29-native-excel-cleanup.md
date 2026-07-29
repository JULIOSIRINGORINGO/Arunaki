# Dev Log — Native Excel + Workspace Connection Fix

**Date:** 2026-07-29
**Author:** AI Software Engineer

## What
1. Menghapus dependensi dan kode Univer/OnlyOffice (`@univerjs/presets`, `@univerjs/preset-sheets-core`, `DocumentEngineHost.tsx`).
2. Menambahkan integrasi native Excel via `winax` di Electron main process (`excel:openNative`).
3. Menyediakan script PowerShell `resources/Win32.ps1` untuk panggil `SetParent`, `SetWindowLong`, `SetWindowPos` jika nanti dibutuhkan reparenting.
4. Memperbaiki alur koneksi folder: frontend sekarang menunggu respons `connect-folder` sebelum menampilkan status "terhubung", sehingga error backend tidak lagi tersembunyi.

## Files Changed
- `apps/desktop/main.cjs` — tambah IPC `excel:openNative` dan `excel:reparent`.
- `apps/desktop/preload.cjs` — expose `openExcelNative` dan `reparentExcel`.
- `apps/desktop/resources/Win32.ps1` — helper C# Win32 (future).
- `apps/desktop/ExcelSandbox.cs` — referensi embed (future).
- `apps/web/package.json` — hapus `@univerjs/presets` dan `@univerjs/preset-sheets-core`.
- `apps/web/src/components/document/DocumentEngineHost.tsx` — dihapus.
- `apps/web/src/components/workspace/FileTree.tsx` — buka file Office lewat `arunakiDesktop.openExcelNative`.
- `apps/web/src/pages/WorkspacePage.tsx` — koneksi folder tunggu respons backend.

## Tests
- `npm run build -w apps/web` — ✅ passed (bundle turun dari 5MB ke 623KB).
- `node --check apps/desktop/main.cjs` — ✅ passed.
- `node --check apps/desktop/preload.cjs` — ✅ passed.

## Notes
- Excel native tetap terbuka di window terpisah Windows; tidak otomatis reparent ke panel Arunaki. Embedding penuh butuh N-API addon untuk `SetParent` (belum dibangun).
- Frontend sekarang menampilkan error jika backend gagal indexing folder.
