# Dev Log — Consolidate @arunaki/tools package layout

**Date & Time:** 2026-09-02 WIB
**Author:** opencode (AI agent)

## What
Wrap-up pertanyaan "kenapa masih ada folder tool/opencode": tiga lokasi `tool`
di repo sudah diaudit dan ternyata BUKAN duplikasi — tiga lapisan berbeda:
`@arunaki/tools` (paket tool dokumen), `@arunaki/core/src/tool` (kerangka tool
generic), `@arunaki/engine/src/tool` (registry engine). Yang benar-benar
redundan adalah nesting `arunaki-tools/src/tools/` (paketnya sendiri sudah
bernama "tools"), sehingga 6 file tool diratakan ke `src/`.

## Files Changed
- `packages/arunaki-tools/src/tools/{excel,word,ppt}-{com,read}.ts` — `git mv`
  → `packages/arunaki-tools/src/` (folder `src/tools/` dihapus).
- `packages/arunaki-tools/package.json` — 6 target `exports` `./src/tools/X.ts`
  → `./src/X.ts` (nama subpath `@arunaki/tools/excel-com` dst TIDAK berubah).
- `packages/arunaki-tools/src/index.ts` — re-export path `./tools/X` → `./X`.
- `excel-read.ts` / `ppt-read.ts` / `word-read.ts` — import internal
  `"../docmap"` → `"./docmap"`.

## Tests
- `bunx tsgo --noEmit` (engine) — ✅ 0 error (registry masih resolve
  `@arunaki/tools/*`).
- `bun test server/httpapi-oauth + httpapi-providers` — ✅ 6 pass (import tools
  via subpath tetap jalan).

## Notes
- `@arunaki/tools` mengimpor `@arunaki/engine/tool` dan engine mengimpor
  `@arunaki/tools/*` → dependency workspace **circular** (jalan di bun, smell
  desain). Fix permanen: pindahkan kontrak `Tool` ke `@arunaki/core`. Tidak
  dikerjakan sekarang (perubahan besar, tidak diminta).
- Referensi `arunaki-tools/src/tools/...` di dev-log lama dibiarkan (provenance).