# Dev Log — Telegram Inline Query & 1-Letter Prefix Matching

**Date & Time:** 2026-09-22 18:50:20 WIB  
**Author:** Antigravity AI Software Engineer

## What
- Mengimplementasikan Telegram Inline Query (`handleInlineQuery`): Saat pengguna mengetik `@BotUsername [huruf]` di chat Telegram, muncul popup melayang di atas keyboard yang menampilkan daftar file yang cocok secara real-time.
- Menambahkan tombol interaktif di `/files`:
  - Tombol `[ 🔍 Cari File (Popup Melayang) ]` yang otomatis memunculkan popup pencarian file di atas keyboard.
  - Tombol pintas untuk masing-masing file (`[ 📄 ORDER.txt ]`) yang menggunakan `switch_inline_query_current_chat` sehingga langsung mengisi nama file ke kolom chat tanpa langsung terkirim, siap ditambahkan instruksi.
- Mengimplementasikan pencocokan awalan huruf (1-letter prefix match) dan nomor urut di backend (`enrichPromptWithFileMentions` & `isBareFileMention`):
  - Pengguna bisa langsung mengetik `@o rekap ke excel` atau `#1 cek total`, dan Arunaki langsung mengenali file `ORDER.txt`.
- Membersihkan prefix `@BotUsername` secara otomatis di pesan masuk jika pengguna mengirim instruksi via inline query.

## Files Changed
- `packages/engine/engine/src/messaging/telegram.ts` — Implementasi `handleInlineQuery`, dukungan `replyMarkup` di `sendTelegramMessage`, penambahan inline keyboard di `/files`, serta pencocokan prefix 1 huruf di `isBareFileMention` dan `enrichPromptWithFileMentions`.
- `packages/engine/engine/test/messaging/telegram.test.ts` — 3 unit test baru untuk pencocokan awalan 1 huruf (`@o`) dan nomor urut (`#1`).

## Tests
- `bun test packages/engine/engine/test/messaging/telegram.test.ts` — ✅ 25/25 passed (0 failed)
- `npm run build -w apps/web` — ✅ Passed (tsc -b && vite build in 12.06s, 0 errors)

## Notes
- Pengguna kini memiliki 3 opsi tanpa mengetik nama panjang:
  1. Ketik 1 huruf langsung: `@o rekap ke excel`
  2. Buka popup melayang: ketik `@BotUsername o` atau klik tombol `🔍 Cari File` di `/files`.
  3. Sentuh tombol file di `/files` yang langsung menempelkan nama file ke kolom chat.
