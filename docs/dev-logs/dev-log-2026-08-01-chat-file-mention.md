# Dev Log — @ File Mention in Chat Input

**Date & Time:** 2026-08-01
**Author:** OpenCode Agent
**Commit:** `79287bb`

## What
Added `@` file mention to the floating chat input in `WorkspacePage.tsx`. User types `@` → a file picker popup appears → selecting a file inserts `@filename ` into the message so the agent gets explicit file context.

## Files Changed
- `apps/web/src/pages/WorkspacePage.tsx` — `ChatInputForm` extended:
  - New prop `files: { name: string }[]` (sourced from existing `wsFiles` query)
  - `mentionQuery` state driven by text after the last `@`
  - Filtered results (max 12, case-insensitive) via `useMemo`
  - Popup with hover/click selection; ArrowUp/Down, Enter/Tab, Escape keyboard nav
  - Insert replaces `@query` with `@filename ` and refocuses input at end

## Design
- Reuses existing `files` query — no new API.
- `@filename` stays literal in the message; agent links it via the workspace file list already injected in the system prompt.

## Tests
- `npx tsc --noEmit` (apps/web) — ✅ clean
- `npm run build` (apps/web) — ✅ built

## Notes
- No design change; popup reuses existing chat styling.
- Manual UI test recommended: type `@`, filter, keyboard select, verify insertion.
