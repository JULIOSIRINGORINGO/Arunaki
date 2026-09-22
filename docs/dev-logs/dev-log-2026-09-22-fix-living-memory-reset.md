# Dev Log — Fix Living Memory Reset & Truncation Bug

**Date & Time:** 2026-09-22 10:06:00 WIB  
**Author:** Antigravity (AI Software Engineer)

## Problem Description
Pengguna menanyakan mengapa Living Memory (`ARUNAKI.md`) terus ter-reset/terpotong padahal sebelumnya sudah dibuat versi lengkap pada 21 September sekitar jam 12:00 WIB yang memuat:
- Domain Profile, Workspace Catalog, Operating Invariants
- User Preferences & Learned Corrections (dengan contoh multiline & breakdown perhitungan)
- **PANDUAN PENGISIAN SPESIFIK**:
  1. `ORDER.TXT — Cara Mengisi`
  2. `LAPORAN-HARIAN.TXT — Cara Mengisi/Update`
  3. `REKAP 9-2026.XLSX — Cara Mengisi (HANYA PEMASUKAN)`
  4. `KATALOG PRODUK — Cara Mengecek (REFERENSI SAJA)`
- **RINGKASAN CEPAT** (tabel ASCII)

## Root Cause Analysis
Ditemukan dua penyebab utama yang membuat file tersebut terpotong/reset berulang kali:

1. **Intervensi Manual AI Asisten di Sesi Obrolan**:
   - Di sesi sebelumnya, asisten AI menganggap file panduan perlu dibuat "lebih ringkas" (dari ~8KB dipadatkan menjadi 2.1KB - 2.9KB) dan menuliskan versi ringkas tersebut ke `LIVING-MEMORY.txt`.
   - Pada 22 September pagi (09:43 WIB), asisten menjalankan perintah python `shutil.copy(r'E:/REKAPAN/LIVING-MEMORY.txt', r'E:/REKAPAN/.arunaki/ARUNAKI.md')`, sehingga menimpa file asli dengan versi ringkas yang kehilangan 4 section panduan dan tabel.

2. **Kelemahan Parser Otomatis di Engine (`packages/engine/engine/src/session/memory.ts`)**:
   - **`extractExistingCorrections`**: Fungsi ini hanya mem-filter baris yang diawali dengan regex flat `/^\s*[-*]\s+/`. Baris-baris indented (seperti contoh ukuran `S 4`, `M 7`, `L 19`, atau baris perhitungan `(Perhitungan: ...)`) serta sub-bullet berinden dibuang/dilepaskan dari induknya.
   - **`applyCorrections`**: Menggunakan regex pengganti `/## User Preferences & Learned Corrections\s*(?:### Learned by the Sentinel)?(?:\s*[-*][^\r\n]*)*(?:[\r\n]+_No learned preferences yet\._)?/`. Begitu regex menemukan baris contoh multiline tanpa tanda peluru (`-`), pencocokan terhenti di tengah, sehingga memotong daftar aturan dan merusak integritas markdown.
   - **`readRulebook`**: Hanya membaca `.arunaki/ARUNAKI.md` tanpa fallback. Jika file terhapus, engine memicu `synthesize` dari nol tanpa aturan yang sudah dipelajari.

## Files Changed
- `packages/engine/engine/src/session/memory.ts`:
  - Mengupdate `extractExistingCorrections` agar mendukung format multiline markdown list items (semua baris yang menjorok/indented 2+ spasi atau baris kosong di dalam bullet point tetap tersimpan utuh).
  - Mengupdate `applyCorrections` dengan regex section boundaries bersih (`/(?=\r?\n## |\r?\n---|\r?\n===|$)/`) sehingga tidak memotong panduan kustom apa pun setelah pemisah `===`.
  - Menambahkan fallback membaca rulebook di `readRulebook`: jika `.arunaki/ARUNAKI.md` kosong/hilang, otomatis memulihkan dari `ARUNAKI.md`, `LIVING-MEMORY.txt`, atau `.arunaki-backup/LIVING-MEMORY.txt`.
  - Menyimpan snapshot backup ke `.arunaki-backup/LIVING-MEMORY.txt` setiap kali Sentinel mempelajari aturan baru.
- `packages/engine/engine/src/arunaki/memory.ts`:
  - Mengubah import `@/session/memory` menjadi `../session/memory` agar kompatibel dan aman di semua module resolver.
- `packages/engine/engine/test/arunaki/memory.test.ts`:
  - Menambahkan unit test `preserves multiline examples and indented sub-bullets in learned preferences`.
- Workspace `E:\REKAPAN`:
  - Memulihkan file asli 21 Sep 12:04:48 WIB (8.087 bytes) secara identik ke:
    - `E:\REKAPAN\.arunaki\ARUNAKI.md`
    - `E:\REKAPAN\LIVING-MEMORY.txt`
    - `E:\REKAPAN\.arunaki-backup\LIVING-MEMORY.txt`

## Verification
- Unit test regex & multiline preservation: ✅ Passed (100% data intact).
- Standalone memory test: ✅ Passed.
- Frontend build: `npm run build -w apps/web` ✅ Passed (0 TypeScript errors, code 0).
- File integrity di `E:\REKAPAN`: ✅ Ketiga file berukuran 8.087 bytes dan memuat lengkap 4 panduan + tabel ringkasan cepat.
