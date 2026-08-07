# Dev Log — Fix AI Error Handling and Tag Parsing

**Date & Time:** 2026-08-07 11:06:00 WIB
**Author:** AI Agent

## What
Perbaikan pada parsing tag XML/HTML dari fallback model dan penanganan UI untuk error fatal dari backend.

## Files Changed
- `apps/api/src/modules/ai/ai.service.ts` — Menambahkan logika `unescapeHtml` sebelum tag diproses, agar tag yang di-escape oleh model (misal: `&lt;function`) tetap bisa dibaca oleh sistem regex perbaikan.
- `apps/api/src/modules/ai/tool-call-repair.ts` — Memperlonggar regex `FUNCT_TAG_RE` agar tahan terhadap spasi berlebih pada tag (seperti `< function >`).
- `apps/web/src/pages/WorkspacePage.tsx` — Memperbaiki bug di mana event `error` dari agen stream backend gagal disisipkan ke dalam riwayat obrolan (chat session). Sekarang jika backend kehabisan rotasi model atau rate-limit, pesan error langsung muncul di chat, bukan hanya layar blank.

## Tests
- `npm run build:api` — ✅ passed
- `npm run build -w apps/web` — ✅ passed
- `npx vitest run test-models-catalog.spec.ts` — ✅ passed (Kenari terkoneksi dan merespons)

## Notes
- Kasus "blank" pada UI sebelumnya disebabkan oleh model Kenari / fallback Llama yang mengeluarkan tag HTML-escaped, lalu memicu rotasi gagal beruntun (exhausted), namun UI gagal menampilkan status error tersebut di timeline chat utama. Semuanya sudah teratasi.
