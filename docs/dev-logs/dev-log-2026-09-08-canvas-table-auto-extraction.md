# Dev Log — Canvas Table Auto-Extraction & Interactive Spreadsheet View

**Date & Time:** 2026-09-08 17:30:00 WIB  
**Author:** AI Software Engineer  

## What
Resolved the user request where structured tabular data / recaps generated in chat (such as ordering, tidying up raw notes, or grouping sizes) did not automatically populate the Center Panel Canvas editor.

### Root Cause
1. In `system.ts`, `CANVAS_INSTRUCTION` previously only triggered `[CANVAS]` tags when the user explicitly said "buat di canvas" or "make in canvas". Casual or concise instructions like "rapihkan", "rekap", "satukan", or "format ke tabel" caused the model to output standard markdown tables without `[CANVAS]` tags.
2. In `canvas.ts`, `extractCanvasContent` only accepted exact `[CANVAS]...[/CANVAS]` blocks, ignoring markdown tables.
3. In `SpreadsheetViewer.tsx`, there was no parser for markdown pipe tables, so even if extracted, markdown tables were not converted into spreadsheet rows and columns.
4. Tables inside chat bubbles lacked an on-demand button to manually open any specific table into the Canvas panel.

### Resolution
1. **Intelligent Table Auto-Extraction (`canvas.ts`)**:
   - `extractCanvasContent` now automatically detects and extracts structured markdown tables (with preceding section/document titles) as Canvas content, in addition to explicit `[CANVAS]` blocks and fenced codeblocks.
2. **Interactive Spreadsheet Parsing (`SpreadsheetViewer.tsx` & `WorkstationCenterPanel.tsx`)**:
   - Implemented markdown table parsing in `SpreadsheetViewer.tsx` via `XLSX.utils.aoa_to_sheet`.
   - Canvas tabs containing markdown tables now render as rich, interactive spreadsheet grids with column letters (A, B, C), formula/cell bar, search, cell selection, and CSV export.
3. **On-Demand "Buka di Canvas" Button (`ChatMessageContent.tsx` & `UnifiedWorkstationPage.tsx`)**:
   - Added a clean toolbar above every table in chat bubbles with a `[🎨 Buka di Canvas]` button.
   - Clicking it immediately dispatches an `arunaki-open-canvas` event to open that exact table in the Center Panel.
4. **Automatic Canvas Restoration (`useWorkstationChat.ts`)**:
   - When switching sessions or reloading, `useWorkstationChat` automatically scans the latest assistant message and restores the Canvas tab in the center panel if data is present.
5. **System Prompt Alignment (`system.ts`)**:
   - Updated `CANVAS_INSTRUCTION` to instruct the AI to wrap structured data, recaps, and organized order lists in `[CANVAS]...[/CANVAS]` by default.

## Files Changed
- `apps/web/src/components/workstation/canvas/canvas.ts`
- `apps/web/src/components/workstation/canvas/SpreadsheetViewer.tsx`
- `apps/web/src/components/workstation/WorkstationCenterPanel.tsx`
- `apps/web/src/components/workstation/chat/ChatMessageContent.tsx`
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts`
- `apps/web/src/pages/UnifiedWorkstationPage.tsx`
- `packages/engine/engine/src/session/system.ts`

## Tests & Verification
- `npm run build -w apps/web`: ✅ Passed (0 TypeScript errors, 16.7s).
- Live browser verification:
  - Table in chat now features the `[🎨 Buka di Canvas]` button.
  - Clicking it or loading the session immediately creates and focuses the `"NSA Kaos Pendek"` Canvas tab.
  - The Center Panel renders the interactive spreadsheet viewer with rows (`Warna`, `Size`, `Qty`) and cells (`Putih`, `S`, `2`).
