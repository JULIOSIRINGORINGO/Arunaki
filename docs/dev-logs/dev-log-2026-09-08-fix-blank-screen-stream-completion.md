# Dev Log — Fix Blank Screen Crash on Chat Stream Completion

**Date & Time:** 2026-09-08 17:10:00 WIB  
**Author:** AI Software Engineer  

## What
Diagnosed and fixed the issue where the Electron workstation window would go completely black / blank immediately after an AI answer finished streaming ("kenapa setelah selesai jawab blank gini harus ctrl+r lagi").

### Root Cause
In `ChatMessageBubble.tsx`, a conditional early return (`if (!hasVisibleContent && !hasThoughtOrSteps) return null;`) was placed at line 51, before the `timeString = useMemo(...)` hook at line 55.
1. When a new assistant message began streaming, `content` was empty and `reasoning` had not yet arrived, causing `hasVisibleContent` and `hasThoughtOrSteps` to be false. The component hit `return null;` having executed only 3 hooks (`useState`, `useMemo`, `useMemo`).
2. When the response finished streaming (or text arrived), `hasVisibleContent` became true, proceeding past line 51 and calling `timeString = useMemo(...)` (a 4th hook).
3. React detected a Hook order violation: `Rendered more hooks than during the previous render` (expected 3, got 4).
4. Because the application lacked a React `ErrorBoundary`, the unhandled render exception caused React to unmount the entire application tree, resulting in a solid black screen until manually reloaded with Ctrl+R.

### Resolution
1. **Strict Adherence to React Rules of Hooks**: Reordered all hooks in `ChatMessageBubble.tsx` to declare unconditionally at the top of the component before any conditional early returns or state checks.
2. **Defensive Deduplication**: Made `allMessages` deduplication in `WorkstationRightChat.tsx` null-safe against undefined or null message content.
3. **React ErrorBoundary Protection**:
   - Created `ErrorBoundary.tsx` with clean Antigravity-styled fallback UI and recovery reload button.
   - Wrapped `<RouterComponent>` in `App.tsx` with top-level `ErrorBoundary`.
   - Wrapped `WorkstationRightChat` in `UnifiedWorkstationPage.tsx` with scoped `ErrorBoundary` to prevent any chat bubble crash from unmounting the workspace.

## Files Changed
- `apps/web/src/components/workstation/chat/ChatMessageBubble.tsx` — Moved `timeString` useMemo to the top before conditional returns; safeguarded `handleCopy`.
- `apps/web/src/components/workstation/WorkstationRightChat.tsx` — Protected `opt.content` and `m.content` trimming with safe fallback.
- `apps/web/src/components/common/ErrorBoundary.tsx` — Created reusable React ErrorBoundary component.
- `apps/web/src/App.tsx` — Enclosed root router in full-screen ErrorBoundary.
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — Enclosed right chat panel in scoped ErrorBoundary.

## Tests & Verification
- `npm run build -w apps/web`: ✅ Passed with 0 TypeScript compilation errors.
- End-to-End browser subagent test on port 5173 with active workspace `E:\JS\laporan-test`:
  - Sent user prompt `"halo"` in session `ses_f7f8c176fffeI4beb0YqvvO6u1`.
  - Monitored streaming thinking phase and final text completion.
  - Verified 0 console errors, 0 hook order violations, and no blank screen crash.
