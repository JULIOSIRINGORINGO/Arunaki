# Dev Log — Excel COM Automation via PowerShell

**Date & Time:** 2026-08-20 11:50 WIB
**Author:** opencode/big-pickle

## What

Fixed critical Excel editing bug: `desktop_excel_edit` was using SheetJS (xlsx library) as fallback when Desktop Bridge disconnected. SheetJS does `XLSX.writeFile()` which is a **full file rewrite** — destroys charts, images, conditional formatting, macros, and all Excel-specific features.

Replaced with PowerShell COM automation that:
- Opens Excel headless (`Visible = false`)
- Uses native COM (`Excel.Application`) to edit cells
- Preserves ALL file integrity (same as manual Excel editing)
- Works on any Windows machine with Excel installed (no VS Build Tools needed)

## Files Changed

- `apps/api/src/modules/interaction/excel-com.service.ts` — NEW: PowerShell-based Excel COM service. Writes temp .ps1 script, executes via `powershell -ExecutionPolicy Bypass`, parses JSON output.
- `apps/api/src/modules/interaction/interaction.module.ts` — Register ExcelComService
- `apps/api/src/modules/tools/services/registrars/desktop-tools.registrar.ts` — Replace SheetJS fallback with ExcelComService
- `apps/api/src/modules/tools/tools-provider.module.ts` — Inject ExcelComService into tool registration

## Tests

- Created test Excel file with headers + data
- COM edit: `write_cell A2` + `set_format A1:C1 bold`
- Verification: A2 changed, B2/C2/row3 preserved, headers intact
- File integrity confirmed — only targeted cells modified

## Notes

- `winax` requires Visual Studio Build Tools to compile native module — not available on this machine
- PowerShell COM approach: no native modules, no build tools, just `powershell.exe` (built into Windows)
- Trade-off: slightly slower than winax (~2-3s for PowerShell startup), but universally available
- SheetJS (`xlsx` package) still used for read-only operations (document_reader) — not removed
