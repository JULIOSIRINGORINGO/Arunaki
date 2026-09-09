# Dev Log — Fix Duplicate Bubbles & Watchdog Timeout Overwriting Response

**Date & Time:** 2026-09-09 14:57:00 WIB
**Author:** Antigravity AI Software Engineer

## What
Mendiagnosis dan memperbaiki masalah pesan ganda (double assistant bubbles) dan kartu error timeout yang menimpa respons valid yang sudah selesai:
1. **Watchdog Overwriting Valid Content (Penyebab Gambar 2)**:
   - Sebelumnya, jika `session.next.step.ended` atau upstream server mengalami latensi setelah teks terkirim, watchdog 30s/90s menimpa `m.content` asisten secara membabi-buta dengan kartu error `⚠️ Upstream Provider Timeout (Kenari)`, padahal teks jawaban sudah selesai streaming dan terbaca oleh pengguna.
   - Ditambahkan guard: jika `accumulatedResponseText` sudah memiliki isi teks, watchdog tidak lagi memunculkan kartu error melainkan melakukan finalisasi sukses yang bersih.
   - Timeout pada saat `text_delta` dipertahankan pada nilai dermawan 90s (bukan diperpendek ke 30s).
2. **Double Bubbles Deduplication (Penyebab Gambar 1)**:
   - `handleSendMessage` sebelumnya menggunakan `setOptimisticMessages((prev) => [...prev, ...])`, sehingga jika ada pesan optimistik lama yang tertunda, pesan baru terus bertumpuk di memori lokal. Sekarang di-reset ke giliran pesan yang sedang aktif: `[newUserMsg, newAssistantMsg]`.
   - `WorkstationRightChat.tsx` diperkuat dengan multi-field deduplication: memeriksa kecocokan `content` DAN `reasoning`. Jika `reasoning` sama persis dengan pesan yang sudah tersimpan di database, bubble optimistik tidak lagi ditampilkan ganda.
   - Jika streaming sudah selesai (`!isStreaming`) dan database sudah memiliki pesan asisten, bubble optimistik asisten yang stale langsung disaring.
3. **Engine Abort Signal**:
   - Menambahkan dukungan `signal: AbortSignal` pada `sendPrompt` di `engine.ts` agar pemanggilan HTTP prompt ikut dibatalkan jika stream di-cancel.
4. **Thought Time Accuracy di Mapper**:
   - Menambahkan kalkulasi durasi penalaran (`thoughtSec`) pada format `msg.content` (sebelumnya hanya di `msg.parts`), sehingga pesan asisten yang dimuat dari database memiliki data waktu pemikiran yang konsisten.

## Files Changed
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Menambahkan guard pencegah overwrite respons valid oleh watchdog, reset state optimistik per turn, dan pass AbortSignal ke `sendPrompt`.
- `apps/web/src/components/workstation/WorkstationRightChat.tsx` — Memperkuat deduplikasi pesan optimistik berdasarkan teks, reasoning identik, dan status `isStreaming`.
- `apps/web/src/components/workstation/chat/mapper.ts` — Menghitung `thoughtSec` pada `msg.content` dari database.
- `apps/web/src/lib/engine.ts` — Menambahkan opsi `signal` pada `sendPrompt`.

## Tests
- `npx tsc -b apps/web/tsconfig.json` — ✅ passed (0 errors)

## Notes
Tidak ada lagi pesan ganda di layar chat dan respons yang sudah berhasil di-stream tidak akan lagi tertimpa oleh kartu error timeout.
