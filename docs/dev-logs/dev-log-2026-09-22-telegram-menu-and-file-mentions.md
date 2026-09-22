# Dev Log — Telegram Native Menu & Document Mention Context Enrichment

**Date & Time:** 2026-09-22 17:21:40 WIB  
**Author:** Antigravity AI Software Engineer

## What
- Mengimplementasikan pendaftaran perintah resmi Telegram Bot API (`setMyCommands`) saat bot aktif, memunculkan tombol `[/ Menu]` biru di Telegram mobile dan desktop.
- Menambahkan handler perintah `/files` untuk menampilkan daftar file yang ada di folder aktif PC dengan format tap-to-copy (`` `@filename` ``) dan ikon dokumen sesuai tipe file.
- Menambahkan handler `/rekap` yang memandu pengguna dalam menggunakan format rekap dokumen.
- Mengimplementasikan deteksi bare file mention (`isBareFileMention`): jika pengguna hanya mengirim `@ORDER.txt` tanpa kata-kata instruksi, bot tidak langsung mengeksekusi secara buta, melainkan memberikan panduan ramah agar pengguna menyertakan instruksi.
- Mengimplementasikan pengayaan konteks mention file (`enrichPromptWithFileMentions`): ketika pengguna mengirim `@ORDER.txt tolong masukkan data ini ke rekap excel`, sistem mendeteksi file yang dirujuk, memeriksa keberadaannya di folder kerja aktif, dan mengemas path serta tipe file bersama instruksi pengguna ke dalam prompt terstruktur untuk LLM engine Arunaki.

## Files Changed
- `packages/engine/engine/src/messaging/telegram.ts` — Pendaftaran `setMyCommands`, handler `/files` dan `/rekap`, fungsi `isBareFileMention`, serta pengayaan prompt `enrichPromptWithFileMentions`.
- `packages/engine/engine/test/messaging/telegram.test.ts` — 8 unit test baru untuk `TELEGRAM_BOT_COMMANDS`, `isBareFileMention`, dan `enrichPromptWithFileMentions`.

## Tests
- `bun test packages/engine/engine/test/messaging/telegram.test.ts` — ✅ 22/22 passed (0 failed)
- `npm run build -w apps/web` — ✅ Passed (tsc -b && vite build in 11.14s, 0 errors)

## Notes
- Menu perintah yang didaftarkan: `/files`, `/rekap`, `/status`, `/new`, `/help`.
- Di Telegram HP maupun desktop, nama file di dalam backticks `` `@filename` `` dapat disalin hanya dengan satu sentuhan/klik, memudahkan pengguna menyisipkan file ke pesan sebelum mengetik instruksi.
