# Dev Log — Fix Context Compaction Gaps

**Date & Time:** 2026-08-05 15:09:00 WIB
**Author:** AG

## What
Fix Temuan #17 & #18 dari GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md:
- Menghapus hard-truncation 40 pesan (naive slice) di `ai.service.ts` (`chat` & `chatStream`) yang menyebabkan silent data loss sebelum proses compaction berjalan.
- Mengaktifkan `useLlmSummary: true` pada inisialisasi `ContextManager` di `ai.service.ts` agar proses meringkas histori untuk Chat Mode dapat menggunakan LLM alih-alih template statis, sekaligus menyatukan pendekatan compaction.

## Files Changed
- `apps/api/src/modules/ai/ai.service.ts` — Menghapus `slice(-40)` dan mengubah `useLlmSummary` menjadi `true`.
- `GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md` — Checklist kriteria penyelesaian ditandai selesai (✅).

## Tests
- `npx vitest run src/modules/ai` — ✅ passed

## Notes
- Perlu dipantau latency di Chat Mode biasa karena peringkasan konteks sekarang akan mengandalkan LLM (jika token melebihi threshold).
