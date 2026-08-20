# Dev Log — Excel COM Multi-Sheet Test + Sheet Bleed Fix

**Date & Time:** 2026-08-20 12:00 WIB
**Author:** opencode/big-pickle

## What

Tested Excel COM automation with complex multi-sheet file (Invoice, Stock, Report). Found and fixed cross-sheet bleed bug where edits to one sheet leaked into another.

**Root cause:** `$ws = $wb.ActiveSheet` was set BEFORE sheet activation logic ran, so `$ws` always pointed to the default active sheet (Invoice) instead of the target sheet.

**Fix:** Moved sheet activation (`foreach` loop) BEFORE `$ws = $wb.ActiveSheet` assignment.

## Files Changed

- `apps/api/src/modules/interaction/excel-com.service.ts` — Reordered PowerShell script: sheet activation now runs before `$ws` assignment

## Test Results

3 sheets edited with different operations:
- **Invoice:** write_cell (D3=60000), set_format (bold+fontSize), new row (B9="TAMBAHAN DATA")
- **Stock:** write_cell (C3="Low Stock"), new row (B6=50), set_format (bgColor)
- **Report:** insert_row (row 6), write_cell x3 (April, 9M, 75)

All 7 integrity checks passed — no cross-sheet bleed, all data correct.

## Notes

- PowerShell COM automation works reliably for multi-sheet Excel files
- Sheet selection via `Activate()` + `$wb.ActiveSheet` is the correct pattern
- File integrity fully preserved across all test scenarios
