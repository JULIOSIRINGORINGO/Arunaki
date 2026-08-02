# Dev Log — Rate Limit Friendly Error

**Date & Time:** 2026-08-02 23:32:00 WIB
**Author:** AI Agents

## What
Pesan error rate limit (HTTP 429) diterjemahkan ke kalimat ramah pengguna sebagai alih-alih stack trace panjang.

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — friendly error pada path gagal.

## Tests
- `npm run test -w apps/api -- workspace-runner.service.spec.ts` — ✅ 5 passed
- `npm run build -w apps/api` — ✅ passed

## Notes
Penyebab sebenarnya adalah rate limit OpenRouter free-models. Solusi jangka pendek: tampilkan pesan jelas. Solusi jangka panjang: tambah provider berbayar atau jadwalkan cooldown.
