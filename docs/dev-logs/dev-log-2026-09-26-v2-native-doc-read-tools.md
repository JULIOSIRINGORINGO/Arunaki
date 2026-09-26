# Dev Log — V2 Native Document Read Tools Integration

**Date & Time:** 2026-09-26 14:50:00 WIB  
**Author:** AI Software Engineer (Pair Programming with User)

## What
Memperbaiki penyebab root-cause mengapa LLM di chat tetap mengeksekusi shell / python (`dir` dan `python -c "from docx import Document..."`) alih-alih native tools (`word_read` / `excel_read`) saat pengguna melampirkan file dokumen Word (`.docx`) atau Excel (`.xlsx`):
1. **Engine Architecture Parity**: Server Arunaki aktif menggunakan arsitektur V2 (`packages/engine/core/src/session/runner/llm.ts`).
2. **Missing Builtins & Circular Dependency**: Built-in tools V2 (`packages/engine/core/src/tool/builtins.ts`) belum menyertakan `word_read`, `excel_read`, dan `ppt_read`. Selain itu, impor langsung dari `@arunaki/tools` memicu siklus sirkular (`@arunaki/core` -> `@arunaki/tools` -> `@arunaki/engine` -> `@arunaki/core`) yang menghasilkan `ReferenceError: Cannot access 'node' before initialization`.
3. **Decoupled Pure Parsers**: Memisahkan fungsi parser murni (`buildWordMap`, `buildExcelMap`, `buildPptMap`) ke sub-modul independen tanpa dependensi `@arunaki/engine`, lalu mendaftarkan `word_read`, `excel_read`, dan `ppt_read` secara bersih ke engine V2 `BuiltInTools`.

## Files Changed
- `packages/arunaki-tools/package.json` — Menambahkan export `./excel-map`, `./word-map`, `./ppt-map`
- `packages/arunaki-tools/src/index.ts` — Mengekspor parser murni dokumen
- `packages/arunaki-tools/src/excel-map.ts` — Parser murni XLSX berbasis `xlsx`
- `packages/arunaki-tools/src/word-map.ts` — Parser murni DOCX berbasis `jszip`
- `packages/arunaki-tools/src/ppt-map.ts` — Parser murni PPTX berbasis `jszip`
- `packages/engine/core/package.json` — Menambahkan dependensi `@arunaki/tools`
- `packages/engine/core/src/tool/word-read.ts` — Implementasi V2 `WordReadTool` (`word_read`)
- `packages/engine/core/src/tool/excel-read.ts` — Implementasi V2 `ExcelReadTool` (`excel_read`)
- `packages/engine/core/src/tool/ppt-read.ts` — Implementasi V2 `PptReadTool` (`ppt_read`)
- `packages/engine/core/src/tool/builtins.ts` — Registrasi `WordReadTool.node`, `ExcelReadTool.node`, `PptReadTool.node`
- `packages/engine/core/test/doc-read.test.ts` — Test suite untuk verifikasi registrasi dan eksekusi baca dokumen murni
- `WORKFLOW.md` — Checklist update

## Tests
- `bun test packages/engine/core/test/doc-read.test.ts` — ✅ 3 pass, 0 fail (registrasi, eksekusi .docx, eksekusi .xlsx)
- `bun test packages/engine/core/test/application-tools.test.ts` — ✅ 11 pass, 0 fail
- `npm run build -w apps/web` — ✅ 0 errors, built in 23s

## Notes
- Setelah commit ini, server dev (`npm run dev:app`) yang direstart akan memuat skema `word_read` dan `excel_read` ke dalam context LLM.
- Ketika pengguna mengunggah dokumen Word/Excel atau meminta pengecekan ukuran/isi, LLM akan langsung memanggil `word_read` / `excel_read` (<50ms) tanpa perlu membuka terminal atau menjalankan python.
