# Dev Log — Fix Spurious Canvas and Empty Tab Auto-Open When Answering Questions

**Date & Time:** 2026-09-05 15:35:00 WIB
**Author:** Antigravity

## What
- Fixed the issue where answering normal questions (such as "cek stok leptop") caused the center panel to open an empty tab titled with the folder name (`laporan-test`) displaying `1 Empty document...`.
- Restricted `tool_live_status` / `tool_start` tab auto-opening exclusively to write/edit tools (`write`, `edit`, `write_to_file`, `replace_file_content`, `apply_patch`, `edit_document`, `create_file`). Read-only inspection tools (`read`, `glob`, `grep`, `list_dir`, `desktop_action`) no longer attempt to auto-open tabs.
- Added strict guards in `handleOpenFileTab` when called silently in background (`silent: true`):
  - Prohibits opening directories or paths without file extensions (e.g. `laporan-test`, `.`, `..`).
  - Aborts immediately if the file cannot be read or has empty content, preventing the creation of dummy `Empty document...` tabs.
  - Prevents stealing active tab focus if the tab already exists.
- Tightened `extractCanvasContent`:
  - Removed over-eager codeblock and markdown table hijack rules that were converting normal chat responses into canvas tabs.
  - Restricted extraction to explicit `[CANVAS]...[/CANVAS]` blocks with substantive content (>= 10 characters), keeping conversational answers and tables cleanly inside the chat bubbles.

## Files Changed
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — updated `extractCanvasContent`, `handleOpenFileTab`, and `tool_live_status` / `text_delta` streaming handlers.

## Tests
- `npm run typecheck` (`tsc -b apps/web/tsconfig.json`) — ✅ passed (0 errors)
- `npm run build -w apps/web` — ✅ passed (0 errors)

## Notes
Center panel now remains clean and focused. Conversational responses stay in chat, and empty dummy tabs are completely eliminated.
