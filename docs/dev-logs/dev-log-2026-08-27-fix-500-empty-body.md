# Dev Log — Fix 500 Empty Body di Endpoint Prompt

**Date & Time:** 2026-08-27 14:55:00 WIB
**Author:** AI Agent (Antigravity)

## What
Mendiagnosis dan memperbaiki *bug* di mana endpoint `POST /session/:sessionID/message` mengembalikan `500` dengan *body* kosong `[]` secara transparan setiap kali ada kegagalan internal (seperti model yang tidak ditemukan di konfigurasi baru).

Masalah aslinya adalah:
1. Kesalahan tipe pengembalian (`HttpServerResponse.stream()`) yang tidak sesuai dengan *schema* `SessionV1.WithParts`.
2. *Defect* yang dilempar dari `promptSvc.prompt()` (`ProviderModelNotFoundError`) ditelan oleh Effect `HttpApiBuilder.handle` dan dikonversi menjadi 500 default body `[]` tanpa masuk ke logger yang terlihat di console.

Perbaikan dilakukan dengan:
- Menambahkan `UnknownError` pada schema `error` endpoint `prompt` dan `promptAsync` di `groups/session.ts`.
- Menerapkan `Effect.catchDefect` pada `handlers/session.ts` untuk mem-parsing pesan *defect* yang ditangkap, lalu men-serialize-nya ke dalam class `UnknownError`.
- Meluruskan *order pipeline* `.pipe` (menjalankan `mapError` sebelum `catchDefect` agar mapping ke 400 Bad Request tidak secara tak sengaja menimpa JSON *defect* aslinya).

## Files Changed
- `packages/engine/opencode/src/server/routes/instance/httpapi/groups/session.ts` — Import dan mendaftarkan `UnknownError` ke list `error` milik `prompt` dan `promptAsync`.
- `packages/engine/opencode/src/server/routes/instance/httpapi/handlers/session.ts` — Import `UnknownError`, dan merangkai `Effect.catchDefect` sebelum *return*.

## Tests
- `npm run typecheck -w @arunaki/engine` — ✅ passed
- `curl.exe` mengirim JSON payload normal dengan model session yang sengaja "not found" — ✅ passed (memunculkan respons 500 `{"_tag":"UnknownError","message":"Model not found: ..."}`). Tidak lagi `[]`.

## Notes
Akar masalah mengapa request ini error di awal hanyalah karena transisi *config* (`config.json` -> `arunaki.json`). Session lama (`ses_fbdee...`) menggunakan model lama (`openai-compatible/mistral-large:free`) yang mungkin hilang di konfigurasi baru, sehingga memicu Exception fatal yang membuat endpoint me-return 500 dengan body tertelan.
Sekarang *error* model not found sudah diekspos dengan benar di JSON.
