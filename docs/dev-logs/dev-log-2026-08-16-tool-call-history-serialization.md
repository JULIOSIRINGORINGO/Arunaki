# Dev Log — Tool-Call History Serialization untuk gpt-oss (Kenari 524/400)

**Date & Time:** 2026-08-16 16:00 WIB
**Author:** opencode (big-pickle)

## What

Perbaiki run rekap <60s dengan gpt-oss-120b. Root cause dibuktikan via probe langsung
terhadap Kenari: back-end gpt-oss **menolak/menghang bila history request mengandung
`tool_calls`/`tool` role** — gpt-oss-20b → HTTP 400 `upstream_rejected` (1.5s),
gpt-oss-120b → HTTP 524 origin timeout (125s). Ukuran request BUKAN pemicu (varian
4.4KB→3.6KB, 2→1 tool, 8192→512 token semuanya tetap 524); satu pasang tool call
(1.2KB) pun sudah cukup. Model tetap bisa *menghasilkan* tool call (round 1 sukses),
hanya tidak bisa *menerima* history tool call native.

Fix: serialisasi seluruh pasangan assistant tool_calls + tool result menjadi teks polos
`[Assistant tool call]: name(args)` / `[Tool result]: ...` sebelum dikirim — pola yang
sama dipakai opencode compaction untuk model non-native tool history.

## Files Changed

- `apps/api/src/modules/ai/model-capability.ts` — field `supportsToolCallHistory?: boolean`
  (default true) + helper `modelSupportsToolCallHistory()`; `gpt-oss-20b`/`gpt-oss-120b`
  di-flag `false` dengan komentar penjelas.
- `apps/api/src/modules/ai/sdk-transformer.util.ts` — fungsi `serializeToolCallHistory()`
  (meratakan pasangan tool_calls + tool result jadi satu pesan assistant teks, role
  ordering valid); dipanggil di `makeSdkRequest` & `makeSdkRequestStream` bila
  `modelSupportsToolCallHistory(provider.model)` false.
- `apps/api/src/modules/ai/sdk-transformer.util.spec.ts` — +4 test (flag gpt-oss false,
  default true, flatten tool history, pesan tanpa tool_calls tidak berubah).
- `WORKFLOW.md` — Phase 33 ditambahkan (root cause, implementasi, verifikasi).

## Tests

- `npx nest build` — ✅ passed
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run src/modules/ai/sdk-transformer.util.spec.ts` — ✅ 10/10 passed
- Harness live `npx tsx scripts/test-rekap-extended.ts gpt-oss-120b` — ✅ **16/17 checks,
  run 31.8s** (dari ~253s hanya untuk round 3)

## Notes

- 1 check gagal: "Tanggal diperbarui ke hari ini" — model tidak update header tanggal di
  file. Bukan masalah infrastruktur; sering gagal lintas model.
- Model otomatis memilih `patchText` diff `*** Begin Patch` untuk edit — mendukung arah
  opencode apply-patch.
- Probe disimpan di `C:\Users\Asus\AppData\Local\Temp\opencode\` (threshold-test.mjs,
  isolate-test.mjs, confirm-test.mjs) untuk audit ulang.
