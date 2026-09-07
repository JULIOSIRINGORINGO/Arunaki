# Dev Log — Fix .xlsm Spreadsheet Parsing & Soft Icon Colors

**Date & Time:** 2026-09-07 19:05:00 WIB  
**Author:** AI Software Engineer  

## What
1. Resolved spreadsheet parsing for macro-enabled Excel workbooks (`.xlsm`, `.xlsb`, etc.) in the Workstation Center Panel so they render as interactive spreadsheet grid tables instead of raw base64 strings (`UEsDB...`).
2. Implemented differentiated, soft muted colors for file explorer icons by file extension (Excel = soft sage/emerald, Word = soft steel blue, PDF = soft coral rose, Presentation = soft amber, Code = soft violet, JSON/Config = soft warm gold, Images = soft teal, Archives = soft sand, Text/Markdown = soft slate).

### Root Cause
- In `WorkstationCenterPanel.tsx`, `isSpreadsheet` previously checked only `xlsx`, `xls`, and `csv`. Files with macro extension `.xlsm` (such as `TABEL REKAPAN NEW2026-.backup-pre-arunaki.xlsm`) evaluated to `isSpreadsheet = false` and fell back to the plain text code editor, displaying the raw base64 zip payload.
- In `tree-utils.tsx`, `getFileIcon` previously hardcoded `text-[var(--text-muted)]` for all file categories, resulting in completely uniform grey icons across all file types.

### Solution
- Updated `WorkstationCenterPanel.tsx` to detect all spreadsheet extensions (`xlsx`, `xls`, `xlsm`, `xlsb`, `csv`, `tsv`) via `/\.(xlsx|xls|xlsm|xlsb|csv|tsv)$/i`.
- In `SpreadsheetViewer.tsx`, trimmed content before base64 decoding to guarantee zero leading whitespace issues during SheetJS parsing.
- Updated `tree-utils.tsx` with dedicated soft color tokens for each category using muted opacity (`/80`–`/85`) to avoid harsh neon tones in both light and dark themes.

## Verification
- SheetJS buffer test via node directly parsed `TABEL REKAPAN NEW2026-.backup-pre-arunaki.xlsm` with all 12 sheets (`JANUARI` through `DESEMBER`).
- `npm run build -w apps/web` compiled with 0 errors in 1.96s.
