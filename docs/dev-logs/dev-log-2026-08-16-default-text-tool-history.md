# Dev Log — Invert Default Tool-Call History ke Text (Semua Model)

**Date & Time:** 2026-08-16 17:00 WIB
**Author:** opencode (big-pickle)

## What

Buat **semua model** memakai tool history dalam bentuk text (serialized) sebagai default,
bukan hanya gpt-oss. Tujuannya agar model baru apa pun yang dipilih user otomatis aman
dari bug Kenari 400/524 tanpa perlu flag manual. Bonus tak terduga: deepseek jauh lebih cepat.

## Files Changed

- `apps/api/src/modules/ai/model-capability.ts` — `modelSupportsToolCallHistory()` default
  dibalik dari `?? true` menjadi `?? false`. Semua model kini serialize tool history; hanya
  model yang eksplisit `supportsToolCallHistory: true` yang pakai native `tool_calls`/`tool` role.
- `apps/api/src/modules/ai/sdk-transformer.util.spec.ts` — test "defaults to true" diubah
  menjadi "defaults to false (serialized text history) so every model is safe by default".

## Tests

- `npx vitest run src/modules/ai/sdk-transformer.util.spec.ts` — ✅ 10/10 passed
- `npx tsc --noEmit` — ✅ clean
- `npx nest build` — ✅ clean
- Harness live `npx tsx scripts/test-rekap-extended.ts deepseek-v4-flash` — ✅ **17/17 checks,
  21.5s & 24.9s** (native: 76.5s & 125.7s → **3-5x lebih cepat**, checks tetap 17/17)

## Notes

- Server di-restart: PID 6768, node `dist/main.js`, health `http://127.0.0.1:3000/api/v1/health`
  (global prefix `api/v1`).
- Bukti `serialized-from-scratch.mjs`: gpt-oss-120b menghitung semua total dengan benar
  (BCA 2.007 = 1.182+300+450+75, BNI 200, CASH 150, PENGELUARAN 570, PEMASUKAN 4.233)
  dari teks `[Tool result]` penuh — konteks tidak hilang saat serialisasi. Fluktuasi
  12-16/17 sebelumnya = perilaku model (gpt-oss menambah total lama vs mengganti), bukan harness.
