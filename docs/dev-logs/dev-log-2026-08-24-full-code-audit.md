# Dev Log — Full Code Audit & Fixes

**Date:** 2026-08-24
**Author:** ox-alpha

## What
Full code audit (3 paralel agent + verifikasi manual) menemukan 2 critical, 8 high, ~10 medium, 8 low. Semua temuan kritical/high dan mayoritas medium diperbaiki dalam 7 commit terpisah.

## Fixed (commit order)
1. `c9574f7` — lazy tool promotion (language-agnostic router fallback)
2. `1251d7c` — CRITICAL: PS injection via excel action fields (sanitizeActions) + snapshot isolation breach (captureFileSnapshot containment)
3. `3b4e885` — zombie EXCEL.EXE (taskkill /T /F), per-file COM mutex, UTF-8 BOM, smart retry, append_row values alias
4. `d8a06d7` — abort propagation chatStream→provider stream, abort = final (no rotation), token budget fungsional (estimasi output)
5. `5037bf9` — repair tool-call tak pernah emit args rusak; phantom text-repair ditekan saat native tool_call ada
6. `5c26c2e` — per-action error isolation, read-only no-save, deteksi summary via Value2 (culture-safe), fallback scan mulai row 2, bgColor RGB
7. `00cf691` — symlink-safe path containment, export_pdf wajib dalam workspace, Chromium leak guard, self-overwrite guard
8. `646b375` — fast cut-off tidak salah picu pada `list`; error terminal terkirim sebelum stream tutup
9. `3102230` — provider rotation: triedIds di-forward di stream fallback, preset tidak wrap-around, kandidat OpenRouter difilter tried set

## Deferred (butuh keputusan desain)
- **M1** rotated providers mewarisi params provider awal (temperature/providerOptions per-model) — perlu refactor body-builder
- **M5** preferredProviderId vs modelId konflesi — perlu API change
- **M6** getSystemPrompt selalu pakai model .env — butuh cache async config
- **L-level**: L1 backoff kondisional, L4 sdk map unbounded, L6 leaked-prefix stall, dll.

## Tests
- `npx tsc --noEmit -p apps/api` ✅ 0 error tiap batch
- `npm run build -w apps/api` ✅ tiap batch
- Self-check COM `check-batch.ts` ✅ 13 aksi (setelah perubahan excel)

## Notes
- Sisa flake stress test T1 berasal dari variasi model free (agnes/mistral), bukan engine — deepseek-v4-flash tetap rekomendasi untuk hasil stabil.
- Server lokal direstart dengan build final.
