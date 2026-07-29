# Dev Log — Embedded XLSX Sheet Parser & Binary Raw Text Blocker

**Date:** 2026-07-29  
**Author:** JULIOSIRINGORINGO (AI Engineer)

## What
Resolved the issue where Excel binary files (`.xlsm`, `.xlsx`, `.xls`) fell back to reading UTF-8 raw text (displaying `PK...` zip headers):
1. **Installed `xlsx` Library in `apps/web`**: Added client-side spreadsheet parsing capabilities to the web workspace.
2. **Multi-layer Fallback Parser in FileTree**:
   - Layer 1: Native Electron IPC `arunakiDesktop.parseExcel`
   - Layer 2: Binary base64 reader `arunakiDesktop.readBinaryFile` + `XLSX.read()` client-side parser
   - Layer 3: Binary card preview blocker (prevents rendering raw text starting with `PK`)
3. **Raw Binary Text Blocker (`activeContentIsRawBinary`)**: Ensures that binary files never render as garbled raw text under any circumstances.

## Files Changed
- `apps/web/package.json` — Added `xlsx` dependency
- `apps/desktop/main.cjs` — Added `fs:readBinaryFile` IPC handler
- `apps/desktop/preload.cjs` — Exposed `readBinaryFile` in `arunakiDesktop` bridge
- `apps/web/src/components/workspace/FileTree.tsx` — Integrated `xlsx` parser, binary extension checker, and raw text blocker

## Verification & Tests
- `npm run typecheck` — ✅ Passed (NestJS API & React Web UI)
- `npm test` — ✅ Passed
