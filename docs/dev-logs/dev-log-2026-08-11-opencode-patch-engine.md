# Dev Log — OpenCode-Style Patch Engine (Phase 32)

**Date & Time:** 2026-08-11 14:45:00 WIB
**Author:** opencode (AI Software Engineer)

## What

Mengganti edit tool Arunaki yang kompleks (LLM-generated `{oldText,newText}` +
9-chain fuzzy replacer + fallback full-content write) dengan engine patch ketat
yang di-port dari opencode (`packages/core/src/patch.ts`, MIT). LLM kini
mengirim patch text (`*** Begin Patch` / `*** Update File:` / `@@` / `-` `+`),
engine melakukan dry-run validasi semua baris konteks, dan hanya menulis bila
semua cocok. Anti-gagal = parse ketat + tolak total tanpa partial write + error
dikembalikan ke LLM untuk self-correct di turn berikutnya.

## Files Changed

- `apps/api/src/modules/tools/services/apply-patch.ts` — baru. Engine patch
  (parse/derive/joinBom, 4-level fuzzy: exact→rstrip→trim→normalized, BOM).
- `apps/api/src/modules/tools/services/apply-patch.spec.ts` — baru. 5 unit test.
- `apps/api/src/modules/tools/services/workspace-tools.service.ts` — `edit` tool
  input `instructions` → `patchText`; hapus `generateEdits`, `fuzzyApplyEdit`,
  `similarity`, injeksi `AiService`, fallback full-content write (~260 baris).
- `apps/api/src/modules/tools/tools-provider.module.ts` — deskripsi tool `edit`
  ditulis ulang bahasa Inggris mengikuti `apply_patch.txt` opencode;
  `estimatedLatency: 'fast'`, `timeoutMs: 60000`.
- `apps/api/src/prompts/rules.md` — §5: pakai `edit` (patch) untuk update file,
  `write` hanya file baru/rewrite penuh.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` —
  `selectToolsForGoal`: saat goal mereferensikan `@file`, `write` dibuang dari
  toolset (pakai `extractMentionedFilenames()` agar konsisten dengan
  `readMentionedFiles`, bukan regex ad-hoc).
- `apps/api/scripts/test-rekap-extended.ts` — tambah log event `tool_start` di
  SSE branch (untuk melihat tool yang dipakai agent).
- `WORKFLOW.md` — Phase 32 ditandai ✅ DONE.

## Tests

- `npx tsc -p apps/api/tsconfig.build.json --noEmit` — ✅ clean
- `npx vitest run apps/api/src/modules/tools/services/apply-patch.spec.ts` — ✅ 5/5
- `npx vitest run apps/api/src/modules/tools apps/api/src/modules/ai apps/api/src/modules/workspace` — ✅ 89/89
- Harness live `node --experimental-strip-types apps/api/scripts/test-rekap-extended.ts` — ✅ 12/12 checks, `[tool_call] edit` (patch path terpakai, bukan `write`)

## Notes

- Patch engine di-port hampir 1:1 dari opencode agar format yang dipelajari LLM
  konsisten dengan ekosistem opencode (model terlatih dengan format ini).
- Keterbatasan format (sama dengan opencode): baris lama dalam satu chunk harus
  kontigu; bagian non-adjacent memerlukan chunk `@@` terpisah. Dokumentasi tool
  sudah menjelaskan ini.
- Verifikasi live menggunakan workspace dev `laporan-test` dan model
  `gpt-oss-120b`; seed ulang file `REKAPAN TERBARU2.txt` diperlukan sebelum
  pengujian berikutnya.
