# Dev Log — Document Map: Baca via Parser, Edit via COM

**Date & Time:** 2026-08-28
**Author:** Arunaki AI Agent

## What
Implementasi pola parse→map→act. Read tools baru (parser-based) menghasilkan
Document Map deterministik; COM tools diubah jadi edit-only dengan target
koordinat yang diambil dari peta, menghilangkan pencarian label fuzzy di COM
(penyebab utama mapping meleset).

## Files Changed
- `packages/arunaki-tools/src/docmap.ts` — BARU: schema Effect DocMap/ExcelMap/WordMap/PptMap + target edit.
- `packages/arunaki-tools/src/tools/excel-read.ts` — BARU: parser xlsx → ExcelMap (cells sparse, merges, formula).
- `packages/arunaki-tools/src/tools/word-read.ts` — BARU: parser jszip → WordMap (paragraphs + tables).
- `packages/arunaki-tools/src/tools/ppt-read.ts` — BARU: parser jszip → PptMap (slide/shape).
- `packages/arunaki-tools/src/tools/excel-com.ts` — edit-only: write_cell/write_range (cell:ref,value), format_cell, clone_sheet, delete_sheet; aksi baca dihapus; description mojibake diperbaiki.
- `packages/arunaki-tools/src/tools/word-com.ts` — edit-only: write_text, write_at_paragraph, find_replace, format.
- `packages/arunaki-tools/src/tools/ppt-com.ts` — edit-only: add_slide, set_shape_text (shapeId/shapeName).
- `packages/arunaki-tools/src/index.ts` — export 6 tool + docmap.
- `packages/arunaki-tools/package.json` — export ./docmap, deps jszip & xlsx.
- `packages/engine/opencode/src/tool/registry.ts` — register excelRead/wordRead/pptRead.
- `docs/DOCUMENT-MAP.md` — BARU: dokumentasi schema + alur.
- `WORKFLOW.md` — Phase 62.4 DONE.

## Tests
- `npm run build -w apps/web` — ✅ passed (0 error TS, vite build 17s).
- `tsc --noEmit -p packages/engine/opencode` — arunaki-tools 0 error; baseline 775 error pre-existing (`@opentui`/`@Arunaki-ai/tui` modul tak resolve di tsc) tidak berubah (#775→#775).
- Parser diuji via bun dengan fixture sintetis: excel (merges + formula), docx (2 paragraf + 1 tabel), pptx (2 slide, shape id/name) — ✅ output map sesuai.

## Notes
- `Tool.define` pola: tanpa type arg + anotasi `execute: (params: Schema.Schema.Type<typeof Parameters>)`; error channel dibuang `.pipe(Effect.orDie)`.
- `Schema.Literal` single-value; multi pakai `Schema.Literals([...])` (docmap WordTarget).
- Executor mengharuskan metadata seragam antar branch execute — error branch mengembalikan `{cells:0}`/`{slides:0}` dst.
- COM edit butuh run manual: Excel/Word/PowerPoint terpasang di mesin Windows.