# Dev Log — Stock Lookup Tool + Location Injection + Crypto Harvester

**Date & Time:** 2026-08-19 09:30:00 WIB
**Author:** Arunaki AI Engineer

## What

Menutup loop "cek stok real-time" E2E: jawaban chat kini berasal dari data asli
via `stock_lookup` (API situs + decrypt client-side), bukan tebakan LLM.

## Akar Masalah yang Ditemukan (2 blocker)

1. **Node knowledge berisi angka halusinasi** — node `cititex-medan-live-matrix`
   (dibuat sesi sebelumnya) berisi "S (16 Left)" dll yang dianggap LLM sebagai
   sumber kebenaran → dijawab tanpa tool call. **Dihapus** via
   `DELETE /api/v1/knowledge/cititex-medan-live-matrix`.
2. **Tool RAG menyaring tool** — `getRelevantToolDefinitions` hanya mengirim 15
   tool (8 core + skor tag). `stock_lookup` (tags stock/inventory/availability)
   dan `ip_geolocation` (geo/ip/location) skor 0 untuk pertanyaan
   "nsa premium red s10 ready ga?" → tidak pernah sampai ke LLM.
   **Fix:** tambah ke `coreToolNames` di `tool-registry.service.ts`.

## Files Changed

- `apps/api/src/modules/tools/services/stock-lookup.tool.ts` — NEW: tool
  `stock_lookup` (registry `STOCK_SITES`, call API cititex + decrypt PBKDF2/AES).
- `apps/api/src/modules/knowledge/services/crypto-harvester.service.ts` — NEW:
  hook fetch/XHR/JSON.parse untuk menangkap & mendekripsi payload terenkripsi.
- `apps/api/src/modules/tools/services/browser-interaction.tool.ts` — NEW:
  tool browser (navigate/click/type/getContent/getHtml).
- `apps/api/src/modules/tools/services/ip-geolocation.tool.ts` — NEW: tool
  `ip_geolocation` (deteksi kota via ip-api, include lat/lon).
- `apps/api/src/modules/tools/tools-provider.module.ts` — registrasi
  IpGeolocationTool + StockLookupTool (providers, exports, registerTools).
- `apps/api/src/modules/tools/tool-registry.service.ts` — `stock_lookup` &
  `ip_geolocation` masuk `coreToolNames` (selalu dikirim ke LLM).
- `apps/api/src/modules/knowledge/knowledge.service.ts` — `searchNodes`
  token-based scoring (fix node tak ter-inject).
- `apps/api/src/modules/knowledge/services/knowledge-crawler.service.ts` —
  integrasi CryptoHarvester di `fetchWithBrowser`.
- `apps/api/src/modules/knowledge/knowledge.module.ts` — provider/export
  CryptoHarvesterService.
- `apps/api/src/modules/interaction/browser-interaction.service.ts` —
  `grantIpGeolocation` + `injectLocationParam` (env `ARUNAKI_DEFAULT_LOCATION`).

## Tests / Verification

- E2E chat `cmszh0y0y0001vgtsfgdz77pl` ("nsa premium red s10 ready ga?"):
  tool calls `ip_geolocation` → `stock_lookup` → jawaban data live:
  Yos Sudarso 52, Dr Mansyur 0, Katamso 7, Adam Malik 6 (Red/S Medan) —
  **cocok ground truth** (sebelumnya LLM halusinasi 16/15/19).
- `npx nest build` — ✅ passed.
- Health check `GET /api/v1/health` — ✅ ok.

## Notes

- Emoji di jawaban LLM tampil rusak (encoding) — kosmetik, belum ditangani.
- `stock_lookup` direct-API adalah jalur cepat; fallback `browser_interaction`
  tetap ada untuk situs tak terdaftar di STOCK_SITES.
- Default lokasi = env `ARUNAKI_DEFAULT_LOCATION=Medan`; UI per-kota menyusul.

## Update 2 — No-Hardcode Refactor (2026-08-19)

`stock_lookup` TIDAK lagi mengandung URL/secret vendor apa pun di kode
(komit sebelumnya masih punya entry cititex.com). Sekarang murni dua jalur:

1. **Auto-learn (direct API)** — `CryptoHarvesterService.learnFromCaptures`:
   saat browser membuka situs yang (a) expose secret decrypt-nya (CryptoJS
   global), (b) memanggil `/stock/{id}/{city}`, (c) payload produk ter-dekripsi
   lewat `JSON.parse` — endpoint template + secret + keySize tercatat
   otomatis, dan `stock_lookup` bisa call API langsung + decrypt offline.
   Situs apa pun, tanpa per-site code.
2. **Browser read (generic)** — untuk semua host lain: render halaman produk,
   baca stok dari (1) payload terdekripsi harvester, (2) SSR JSON di HTML
   (normalisasi `\"` escaped JSON), (3) baris teks yang menyebut stok.
   Tool menambah query param `color`/`size`/`location` bila belum ada
   (halaman produk umumnya baru memuat stok setelah varian dipilih).

Verifikasi tanpa hardcode:
- E2E `cmszi1eqn0001vglcz5c151tm`: "nsa premium red s10 ready ga?" →
  `ip_geolocation` → `stock_lookup` → "Red S Medan: 65 pcs — Ready" (ground
  truth 65) — via browser read, tanpa secret cititex di kode.
- `crypto-harvester.service.spec.ts` (5 test: learn sukses, tanpa secret,
  payload bukan stok, tanpa request stock, learn sekali) — ✅
- `stock-lookup.tool.spec.ts` (2 test: fixture page `file://` dibaca,
  halaman tanpa stok → NO_STOCK_FOUND) — ✅
- `npx nest build` — ✅

Files changed tambahan:
- `stock-lookup.tool.ts` — hapus `STOCK_SITES`/secret cititex; `learnedSiteFor`
  hanya dari harvester; `lookupViaBrowser` + `extractSsrRows` +
  `extractTextRows` + query-param inject.
- `crypto-harvester.service.ts` — `collect` return `{url, body}[]` untuk
  request terenkripsi; `learnFromCaptures` (auto-register); `stockPayloadsFrom`.
- `knowledge-crawler.service.ts` — tipe `apiEncrypted` disesuaikan.
- `stock-lookup.tool.spec.ts`, `crypto-harvester.service.spec.ts` — baru.

Open question: verifikasi auto-learn di situs nyata belum ada (cititex tidak
expose secret-nya) — simulasi via spec sudah menutup logikanya.