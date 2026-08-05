# Dev Log — Tokenizer Akurat Dipakai untuk Keputusan (Gap #2)

**Date & Time:** 2026-08-05 10:41:00 WIB
**Author:** AI Software Engineer (opencode)

## What
Menutup Gap #2: `ContextManager.estimateTokens()` sebelumnya memakai heuristik `Math.ceil(text.length / 4)` untuk semua keputusan compaction/budget, sementara `countTokens()` berbasis tiktoken di `ai.service.ts` tidak pernah dipanggil (dead code). Solusi: extract tokenizer ke util shared + cache, dipakai oleh `estimateTokens()` dan `countTokens()`.

## Files Changed
- `apps/api/src/modules/ai/tokenizer.ts` [NEW] — `countTokens(text)`: tiktoken `cl100k_base`, fallback char/4 hanya saat throw, bounded string cache (10k entries).
- `apps/api/src/modules/ai/context-manager.ts` — `estimateTokens()` pakai `countTokens` dari util (content + tool_calls).
- `apps/api/src/modules/ai/ai.service.ts` — `countTokens()` delegasi ke util shared (bukan dead code lagi).
- `apps/api/src/modules/ai/context-manager.spec.ts` — 2 test baru (Bahasa Indonesia panjang + JSON tool result, exact match dengan tokenizer).
- `WORKFLOW.md` — Phase 45.2.

## Tests
- `npx vitest run src/modules/ai/context-manager.spec.ts` — 11/11 passed.
- `npx vitest run src/modules/ai` — 32/32 passed.
- `npm run build` — 0 errors.

## Notes
- Test awal punya asersi `total < char/4` yang ternyata salah untuk teks Bahasa Indonesia berulang (tiktoken justru menghasilkan lebih banyak token untuk teks ID repetitif) — diganti ke exact match dengan tokenizer asli.
- `this.enc` di `ai.service.ts` tetap ada (dipakai di prompt-length check lain); hanya `countTokens()` yang dialihkan.
