# Dev Log — Native Excel External Window & Embedded Non-Office Viewer Architecture

**Date & Time:** 2026-07-29 23:58:30 WIB  
**Author:** Antigravity AI Engineer  

## What
Refined file opening routing in `FileTree.tsx` and `WorkspacePage.tsx` and resolved Prompt Injection False Positive error:

1. **Microsoft Excel Documents (`.xlsx`, `.xlsm`, `.xls`)**:
   - Opens natively in standalone Microsoft Excel Desktop application for 100% stable performance and COM Automation Agent Use.

2. **Non-Office Files (`.txt`, `.json`, `.md`, `.pdf`, `.csv`, code files)**:
   - Opens embedded directly inside Arunaki's built-in file viewer & code editor modal!
   - Reads file content via `arunakiDesktop.readFile` and displays it cleanly within the Arunaki UI.

3. **Prompt Injection False Positive Fix (`prompt-injection-detector.service.ts`)**:
   - Fixed regex pattern `/DAN/i` by adding word boundaries `/\bDAN\b/i`.
   - Previously, standard Indonesian words containing "dan" (like `"dan"` or `"mendalam"`) triggered a false-positive jailbreak block (`Error: Input mengandung konten yang tidak diizinkan`).

## Files Changed
- `apps/api/src/modules/ai/prompt-injection-detector.service.ts` — Added word boundaries `\b` to `DAN`, `STAN`, `MONG` regex patterns to eliminate Indonesian word false positives.
- `apps/web/src/components/workspace/FileTree.tsx` — Updated `handleItemClick` to route Excel files natively and non-Office files embedded inside Arunaki.
- `apps/web/src/pages/WorkspacePage.tsx` — Removed blocking `onFileClick` callback wrapper so `FileTree` handles text and binary file embedded previews seamlessly.
- `apps/api/.env` — Configured active verified OpenRouter model `google/gemma-4-31b-it:free`.

## Tests
- `npx tsc --noEmit` in `apps/web` — ✅ Passed (0 errors)
- `npm run test` in `apps/api` — ✅ Passed
- Prompt injection false positive check for Indonesian words ("dan", "mendalam") — ✅ Passed

## Notes
- Prompt injection detector now accurately flags real attacks while allowing standard Indonesian prompts like "Baca dan analisis file mendalam".
