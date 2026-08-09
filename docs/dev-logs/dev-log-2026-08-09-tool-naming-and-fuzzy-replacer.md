# Dev Log — Tool Naming & Fuzzy Replacer

**Date & Time:** 2026-08-09 21:04:00 WIB
**Author:** Antigravity

## What
Mengimplementasikan perbaikan alat operasi berkas (*file operation tools*) seperti yang diriset dan disarankan dalam `TOOL-NAMING-RESEARCH.md`. Tujuannya adalah membuat *LLM* (terutama yang lebih kecil) tidak kesulitan dengan nama alat yang panjang dan memperbaiki isu `EMPTY_EDITS` pada operasi pengeditan berkas.

Pekerjaan yang dilakukan:
1. Menyingkat nama alat (misal `read_workspace_file` ➔ `read`) dan menerjemahkan deskripsinya ke bahasa Inggris.
2. Memasukkan *fuzzy replacer* ke `editWorkspaceFile` dengan alur mundur (*fallback*) otomatis dari *Exact Match* ke *Line Trimmed* ke *Block Anchor*.
3. Menambahkan pengawal `isDisproportionateMatch` agar pengeditan tidak menimpa teks melebihi proporsi yang wajar (batas: ~2x panjang *oldText*).
4. Menyegarkan seluruh penyebutan variabel dan *prompt* di dalam *workspace runner* dan memastikan *unit testing* sukses.

## Files Changed
- `apps/api/src/modules/tools/tools-provider.module.ts` — Renaming tool definitions (read, write, edit, rename, delete, list).
- `apps/api/src/modules/tools/services/workspace-tools.service.ts` — Implemented fuzzy string replacement logic and updated `metadata.toolName` returns.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Updated references and prompt logic to point to the shortened tool names.
- `apps/api/src/modules/tools/tool-registry.service.spec.ts` — Updated test strings.
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — Updated test strings.
- `apps/api/src/modules/ai/tool-loop-detector.service.spec.ts` — Updated test strings.

## Tests
- `npx tsc --noEmit -p tsconfig.build.json` — ✅ passed (setelah memperbaiki duplikasi sintaks).
- `npm run test` di `apps/api` — ✅ passed (142 tes berlalu hijau).

## Notes
- Dengan nama yang lebih pendek, token *prompt* lebih hemat, dan LLM kini dapat lebih mudah memfokuskan argumen alat (*tool arguments*) ketimbang nama alat yang menjebak.
- *Fuzzy replacer* menjamin LLM tidak perlu sempurna per *whitespace* ketika memberikan `oldText`.
