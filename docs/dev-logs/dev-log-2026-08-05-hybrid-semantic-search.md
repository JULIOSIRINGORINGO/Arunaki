# Dev Log — Hybrid Memory Search (Gap #10)

**Date & Time:** 2026-08-05 12:20 WIB
**Author:** opencode AI Agent

## What
Menambahkan semantic search sebagai lapisan kedua di atas FTS5 keyword search. Query yang sama-makna-bedakata (`"harga jual"` vs `"nilai penjualan"`) yang gagal di FTS5 kini bisa ditemukan via cosine similarity embedding. Pendekatan hybrid: FTS5 tetap primary, semantic hanya fallback saat hasil sparse (<3).

## Files Changed
- `apps/api/src/modules/memory/semantic-search.service.ts` — BARU. Lazy pipeline `Xenova/all-MiniLM-L6-v2` via transformers.js; `embed()` (mean pooling, normalize); `semanticSearch()` cosine similarity atas cache tabel `message_embeddings`; backfill on-demand (LIMIT 200/query, batch 20); return `[]` saat model gagal load.
- `apps/api/src/modules/memory/session-search.service.ts` — `search()` jadi hybrid: hasil FTS5 <3 → supplement semantic results (dedup by messageId, sort, slice limit). Inject `SemanticSearchService`.
- `apps/api/src/modules/memory/memory.module.ts` — register `SemanticSearchService` sebagai provider + export.
- `apps/api/src/modules/memory/semantic-search.service.spec.ts` — BARU, 6 test.
- `apps/api/src/modules/memory/session-search.service.spec.ts` — BARU, 5 test hybrid fallback.
- `apps/api/package.json` — dependency `@xenova/transformers@^2.17.2` (disetujui user).
- `WORKFLOW.md` — Phase 45.7.

## Tests
- `npx vitest run src/modules/memory/semantic-search.service.spec.ts` — ✅ 6/6
- `npx vitest run src/modules/memory/session-search.service.spec.ts` — ✅ 5/5
- `npx vitest run` (full api) — ✅ 119/119
- `npm run build` — ✅ 0 errors
- Smoke test node: model `Xenova/all-MiniLM-L6-v2` load & embed sukses (dims [1,384]).

## Notes
- **Fix bug penting:** `new Float32Array(row.embedding)` memperlakukan Buffer (Uint8Array) sebagai array elemen, bukan bytes → cosine similarity jadi nonsense. Solusi: `bufferToFloat32()` reinterprets `buf.buffer` + `byteOffset` + `byteLength` sebagai Float32Array.
- Model (~90MB) didownload otomatis saat semantic search pertama kali jalan (HF cache). Tidak ada konfigurasi tambahan. Kalau offline, layer FTS5 tetap berfungsi penuh (semantic swallow errors).
- Threshold 0.35 (cosine) dipilih agar false-positives tidak mencemari recall; bisa disetel via tuning lapangan.
- Batas 200 messages/backfill adalah kompromi — pertama kali jalankan dengan DB besar, recall semantic baru lengkap setelah beberapa query.
