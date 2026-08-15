# Dev Log — Resilient Patch Healing & Small-Model Fault Tolerance

**Date & Time:** 2026-08-15 19:10:00 WIB  
**Author:** AI Software Engineer

## What
Membangun harness auto-healing diff patch dan surgical replace fallback untuk model kecil (<100B, 30B, 8B) agar tidak gagal saat formatting patch tidak sempurna.

### Root Cause
1. **Malformed `changeContext`**: Model kecil sering menaruh sisa diff pada baris `@@` (contoh: `@@ -CK AGU`), yang menyebabkan diff parser mengira itu nama baris context asli di file.
2. **Missing Diff Prefix**: Baris yang tidak diubah sering tidak memiliki prefix spasi ` ` atau memuat nomor baris `1: ...`.
3. **Overly Strict Parser Crash**: Strict unified diff engine langsung gagal jika ada perbedaan whitespace atau line index drift.

### Solution & Changes Made
1. **`patch-healer.ts`**:
   - `healPatchText`: Membersihkan code fences, heredocs, auto-repair `@@` headers, strip line number prefixes (`1: ...`), dan auto-format marker `*** Begin/End Patch`.
   - `extractAndApplyFallback`: Fallback parser cerdas jika parsing diff gagal total, mengekstrak blok `oldLines` vs `newLines` dan melakukan fuzzy block replacement pada target file.
2. **`apply-patch.ts`**:
   - Menoleransi baris context tanpa prefix spasi.
   - Dual search fallback (mencari dari `lineIndex`, jika gagal otomatis fallback cari dari `line 0`).
   - Line-number stripped search.
3. **`edit-tool.service.ts`**:
   - Integrasi `healPatchText` dan `extractAndApplyFallback`.
   - Multi-tier direct surgical replacement fallback saat hunk derive menemui error.

## Tests
- `npx vitest run apps/api/src/modules/tools/services/apply-patch.spec.ts` — ✅ 7 passed (100%)
- `npx tsx apps/api/scripts/test-rekap-extended.ts gemini-2-5-flash` — ✅ 17/17 passed in 4.7s
- `npx tsx apps/api/scripts/test-rekap-extended.ts gemini-3-1-flash-lite` — ✅ 17/17 passed in 4.2s

## Status
✅ PASS & READY
