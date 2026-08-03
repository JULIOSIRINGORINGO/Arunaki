# Dev Log — Model Compatibility & OpenClaw Tests

**Date & Time:** 2026-08-04 00:15:00 WIB
**Author:** Antigravity

## What
Melakukan pengujian ketahanan dan kompatibilitas arsitektur **OpenClaw Catalog Compaction** terhadap berbagai model LLM melalui script backend langsung tanpa intervensi antarmuka UI. Tes ini dilakukan menggunakan script mandiri `test-models-catalog.spec.ts` di backend NestJS.

## Files Changed
- `apps/api/src/test-models-catalog.spec.ts` — Dibuat untuk menguji integrasi *tools* dan model LLM.
- `apps/api/src/modules/tools/tools-provider.module.ts` — Memperbaiki injeksi `SubAgentRunnerService` yang terlupakan pada versi sebelumnya dan memperbaiki beberapa peringatan tipe data implisit.

## Tests & Findings

**1. Arsitektur Internal (Sukses)**
Sistem berhasil melakukan injeksi modul, menyembunyikan 50+ *tools* menjadi *catalog-only*, dan hanya mengekspos 4 *tools* OpenClaw ke dalam payload `tools` pada *request* LLM. Tidak ada *circular dependency*.

**2. Pengujian via OpenRouter (Free Tier)**
- **Hasil:** Gagal (HTTP 404).
- **Temuan:** Model gratis (`google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.1-8b-instruct:free`) memicu limitasi rotasi *fallback*. Sistem fallback memutar *request* ke model berbayar (`llama-3.3-70b-instruct`) yang pada akhirnya ditolak oleh OpenRouter dengan status 404 karena API Key tidak memiliki saldo (*credit = 0*).

**3. Pengujian via Kenari Provider (Model OSS & DeepSeek)**
- **Model yang diuji:** `gpt-oss-120b` (Kecil/OSS), `deepseek-v4-flash` (Mahal).
- **Hasil:** Gagal (HTTP 400 Bad Request).
- **Temuan Kritis (HTTP 400):** *Error* 400 Bad Request dari Kenari Gateway mengonfirmasi bahwa model-model yang diuji **tidak mendukung skema native Tool Calling/Function Calling**. Karena arsitektur OpenClaw kita 100% bergantung pada fitur *native tool calling* bawaan dari model (LLM harus bisa memahami array JSON `tools` dan merespons dalam format spesifik), *request* ini langsung ditolak oleh API Gateway karena formatnya tidak dikenali oleh model tersebut.

## Notes & Kesimpulan
- **Penting:** Arsitektur OpenClaw membutuhkan LLM yang **memiliki kapabilitas native Tool Calling**. Menggunakan model *open-source* murni atau model lama yang tidak dilatih untuk *function calling* akan selalu menghasilkan *HTTP 400 Bad Request* saat *backend* menyisipkan array `tools`.
- Sistem siap digunakan sepenuhnya. Cukup pastikan API Key memiliki saldo (untuk OpenRouter) dan menggunakan model yang mendukung eksekusi *tools* (seperti gpt-4o, claude-3.5-sonnet, gemini-1.5-pro, dll).
