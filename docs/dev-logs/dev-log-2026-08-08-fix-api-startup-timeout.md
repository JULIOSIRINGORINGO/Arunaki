# Dev Log — Fix API Startup Timeout (dev-app)

**Date & Time:** 2026-08-08 04:49:00 WIB
**Author:** Antigravity

## What
Mendiagnosis dan memperbaiki masalah `npm run dev:app` yang selalu gagal dengan pesan `[dev-app] GAGAL: API tidak merespon setelah 60 detik`.

**Penyebab Masalah:**
1. Ada beberapa file skrip uji coba sementara (`test-terminal-agent.ts`, folder `scripts/`) yang tersisa di *root* `apps/api`.
2. TypeScript (via `npx nest build`) secara default mengompilasi semua file `.ts` tersebut karena tidak ada konfigurasi `exclude` yang ketat.
3. Karena ada file di luar folder `src/`, TypeScript mengubah struktur hierarki di dalam folder output `dist/`, sehingga `main.js` tidak berada di `dist/main.js`, melainkan di `dist/src/main.js`.
4. *NestJS* mencoba me- *load* `dist/main.js` dan gagal (melempar `MODULE_NOT_FOUND`). Proses yang *crash* berulang kali / *zombie process* yang nyangkut di port menyebabkan *startup script* menunggu (timeout) selama 60 detik.

**Solusi:**
1. Menghapus file skrip sementara (`test-terminal-agent.ts` & folder `scripts`).
2. Menambahkan `*.ts` dan `scripts` ke dalam daftar `exclude` di `apps/api/tsconfig.build.json` untuk mencegah perubahan hierarki *output directory* terulang kembali jika ada file di *root*.
3. Membunuh *zombie process* yang memblokir port 3000 dan 31524.
4. Menjalankan `npm run dev:app` dari awal.

## Files Changed
- `apps/api/tsconfig.build.json` — Menambahkan `*.ts` dan `scripts` ke dalam array `"exclude"`.
- *Deleted:* `apps/api/test-terminal-agent.ts` & `apps/api/scripts/`.

## Tests
- `npm run dev:app` — ✅ passed (API, Vite, dan Electron semuanya berhasil *startup* dengan lancar).

## Notes
- Electron membutuhkan sekitar 24 detik untuk menunggu Vite melakukan *cold start*, tapi setelah itu semuanya langsung otomatis diluncurkan.
