# Dev Log — Fix Overzealous File Scanning & Python Standard Library Collision (Phase 87)

**Date & Time:** 2026-09-12 12:31:00 WIB
**Author:** AI Software Engineer

## What
1. **Pencegahan Akses File Berlebihan (Overzealous File Scanning) saat Chat Kasual**:
   - Memperbaiki `packages/engine/engine/src/session/system.ts` dan `packages/engine/engine/src/session/prompt/default.txt`.
   - Mengubah aturan identitas kaku menjadi aturan yang menghormati konteks percakapan manusiawi:
     - Jika pengguna bertanya santai, meminta kutipan, motivasi, cerita, rekomendasi, atau pertanyaan lanjutan ambigu seperti *"ada yang menarik?"* / *"ada lagi?"*, model **DILARANG KERAS** membuka, memeriksa, atau mengaudit file dokumen workspace.
     - Model diwajibkan menjawab secara kontekstual dan komunikatif tanpa menjalankan tools.
     - Tools dokumen hanya boleh dijalankan jika pengguna secara eksplisit menyebut file/dokumen/laporan atau menempelkan data mentah.
2. **Pencegahan Tabrakan Modul Python (Python Standard Library Shadowing) di Level Tool**:
   - Di `packages/engine/engine/src/tool/write.ts`, menambahkan proteksi blacklist nama modul Python bawaan (`inspect.py`, `types.py`, `code.py`, `string.py`, `copy.py`, `json.py`, `io.py`, `os.py`, dll).
   - Jika model mencoba membuat script bernama `inspect.py`, tool `write` langsung menolak dengan error deskriptif yang menyuruh model menggunakan prefix `arunaki_inspect.py`.
   - Menghapus celah curhat teknis ke chat pengguna.

## Files Changed
- `packages/engine/engine/src/session/system.ts` — Menambahkan batasan tegas obrolan santai vs tugas dokumen dan etika pesan ke chat pengguna.
- `packages/engine/engine/src/session/prompt/default.txt` — Mempertegas larangan menjalankan tools untuk pertanyaan santai/kreatif.
- `packages/engine/engine/src/tool/write.ts` — Menambahkan validasi `PYTHON_STDLIB_SHADOWS` agar tidak ada file skrip yang menabrak modul bawaan Python.

## Verification
- `npm run build -w apps/web`: ✅ Build sukses dalam 23.42s dengan 0 error kompilasi TypeScript.
- Browser E2E Test di `http://localhost:5173/?folder=E%3A%5CREKAPAN`:
  - Mengirim pertanyaan lanjutan: *"ada kutipan kata-kata yang lebih menarik lagi?"*.
  - Terverifikasi model **TIDAK menjalankan tool dokumen apa pun** dan tidak membaca file folder.
  - Model menjawab dengan sangat ramah, kaya, dan kontekstual (kategori semangat kerja, ketekunan, keteguhan hati, dan kutipan pendek).
  - Bukti visual tersimpan di `e2e_test_quote_response_1789190955864.png`.
