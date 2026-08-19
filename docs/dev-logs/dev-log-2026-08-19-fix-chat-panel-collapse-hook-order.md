# Dev Log — Fix Chat Panel Collapse Hook Order Crash

**Date & Time:** 2026-08-19 17:51:50 WIB
**Author:** Antigravity AI

## What
Fixed a critical React Rules of Hooks violation in `WorkstationRightChat.tsx`.
Previously, `useLayoutEffect`, `useMemo(mentionResults)`, and `useMemo(filteredCommands)` were positioned *after* `if (collapsed) return (...)`. When the user clicked the close panel button, `collapsed` became `true`, causing React to throw `Error: Rendered fewer hooks than expected` and crashing the entire component tree into a blank screen.

Moved all hooks unconditionally to the top of the component before any early returns.

## Files Changed
- `apps/web/src/components/workstation/WorkstationRightChat.tsx`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2200 modules transformed)
