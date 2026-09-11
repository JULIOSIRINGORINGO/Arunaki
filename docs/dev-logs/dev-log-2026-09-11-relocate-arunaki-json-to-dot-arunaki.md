# Dev Log — Relocate Workspace Config to .arunaki & Hide from Explorer

**Date & Time:** 2026-09-11 13:51:00 WIB  
**Author:** AI Software Engineer (Antigravity)

## What
Menindaklanjuti masukan pengguna mengenai file konfigurasi internal `arunaki.json` yang sebelumnya muncul di root folder kerja pengguna (misal `E:\REKAPAN\arunaki.json`) dan tampil di panel Explorer dokumen:
1. Menyelaraskan penyimpanan konfigurasi workspace agar secara eksklusif ditulis ke dalam folder tersembunyi `.arunaki/arunaki.json`, mencegah polusi pada folder root kerja dokumen pengguna.
2. Memastikan pembacaan konfigurasi di engine mendukung format direktori `.arunaki` secara case-insensitive (`.arunaki` dan `.Arunaki`).
3. Menambahkan pembersihan otomatis (*self-cleanup*) pada `Config.update` sehingga file `arunaki.json` lama di root folder dihapus setelah disinkronkan ke `.arunaki/arunaki.json`.
4. Menyaring file `arunaki.json` dan `arunaki.jsonc` dari panel Explorer dokumen desktop (`apps/desktop/main.cjs`) dan web UI (`apps/web/src/components/workspace/tree-utils.tsx`), sehingga pengguna tidak sengaja mengedit, merusak, atau menghapus file konfigurasi sistem.

## Files Changed
- `packages/engine/engine/src/config/paths.ts`:
  - Menambahkan `.arunaki` (huruf kecil) ke daftar targets `ConfigPaths.directories`.
- `packages/engine/engine/src/config/config.ts`:
  - Mengubah pencarian direktori menjadi case-insensitive: `dir.toLowerCase().endsWith(".arunaki")`.
  - Memperbarui `Config.update` untuk membuat folder `.arunaki` dan menulis konfigurasi ke `.arunaki/arunaki.json`, serta menghapus root `arunaki.json` jika ada.
  - Memperbarui `Config.deleteProvider` agar membaca dari `.arunaki/arunaki.json` dengan fallback ke root file.
- `apps/desktop/main.cjs`:
  - Menambahkan `arunaki.json` dan `arunaki.jsonc` ke dalam set `IGNORED` pada `fs:getFolderTree`.
- `apps/web/src/components/workspace/tree-utils.tsx`:
  - Memfilter `arunaki.json` dan `arunaki.jsonc` pada `buildTree` dan `nativeToTreeNodes`.
- `WORKFLOW.md`:
  - Menambahkan catatan milestone Phase 77.

## Verification & Tests
- File `E:\REKAPAN\arunaki.json` berhasil dipindahkan ke `E:\REKAPAN\.arunaki\arunaki.json`.
- Root folder `E:\REKAPAN` kini hanya berisi dokumen kerja asli: `REKAP 9-2026.xlsx` dan `REKAPAN TERBARU2.txt` (plus folder internal tersembunyi `.arunaki`).
- `npm run build -w apps/web` ✅ (lulus 0 error kompilasi TypeScript dalam 27.53 detik).
