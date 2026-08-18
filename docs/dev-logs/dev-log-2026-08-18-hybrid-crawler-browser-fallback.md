# Dev Log — Hybrid Crawler: Playwright Fallback untuk JS-Only Data

**Date & Time:** 2026-08-18 20:20 WIB
**Author:** Arunaki AI

## What

Knowledge crawler menjadi **hybrid**: fast path HTTP+Turndown (tetap default), ditambah **browser path** (Playwright) untuk data yang hanya muncul setelah JS render — khususnya **stok per wilayah cititex.com** yang membutuhkan interaksi drawer "Pesanan Grosir".

## Temuan Investigasi (cititex.com)

1. Stok per lokasi **TIDAK ada di SSR HTML** — hanya muncul setelah membuka drawer "Pesanan Grosir" → klik "Locations" → pilih kota.
2. API `category/stock/{productId}/{city}?isWholesale=true` merespons **terenkripsi** (`encrypt:"..."`) — HTTP murni mustahil mengekstraknya.
3. Alur browser yang terbukti bekerja: klik "Pesanan Grosir" → drawer MUI terbuka → klik tombol "0 Locations" → popover "Pilih Lokasi" → pilih kota (dispatch mousedown/mouseup/click) → tabel stok per cabang × ukuran S-5XL muncul (contoh: `Buaran Jakarta Timur — 103 / 39 Left / Habis / 0 Pcs`).

## Benchmark

| Path | Durasi | Konten |
|------|--------|--------|
| HTTP (fast) | ~0.6s | 34.568 chars (harga, warna, deskripsi) — tanpa stok |
| Browser (Playwright) | ~12.8s | stok per cabang lengkap |

Cache 5 menit berlaku untuk kedua path (cache key include `browser` & `stockLocation`).

## Files Changed

- `apps/api/src/modules/knowledge/services/knowledge-crawler.service.ts` — opsi `browser` + `stockLocation`; method `fetchWithBrowser()` (launch chromium, alur drawer cititex, fallback body/drawer text); `extractLocationFromUrl()`; cache key diperluas.
- `apps/api/src/modules/tools/services/knowledge-live-fetch.tool.ts` — schema + inputSchema + description untuk `browser` dan `stockLocation`.

## Tests

- `npx nest build` — ✅ passed (0 error)
- Benchmark `bench-hybrid.tmp.cjs` (di-delete setelah run): HTTP 629ms / Browser 12.812ms, `has Left/Habis: true` pada browser path.

## Notes

- `playwright` sudah terpasang (dipakai `browser-interaction.service.ts`), tidak ada dependency baru.
- Dynamic import `playwright` hanya pada browser path — fast path tidak kena overhead.
- LLM tetap perlu URL benar dari Knowledge node; browser path tidak memperbaiki URL-guessing.
