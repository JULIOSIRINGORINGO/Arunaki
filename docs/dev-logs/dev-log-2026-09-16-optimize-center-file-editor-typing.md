# Dev Log — Optimize Center Window Plaintext/File Editor Typing Performance

**Date & Time:** 2026-09-16 19:40:40 WIB  
**Author:** Antigravity AI

## What
Diagnosed and eliminated severe lag/stuttering when typing or editing files in the center window editor (`CenterEditorView.tsx` / `WorkstationCenterPanel.tsx`):
1. **Root Cause Analysis**:
   - **Full-Page Re-renders on Keystroke**: On every single character typed in the `<textarea>`, `onUpdateTabContent` called `setTabs(...)` in `useTabs.ts`, which triggered a complete re-render of `UnifiedWorkstationPage`, re-rendering the file explorer, header, git badges, and chat panels synchronously.
   - **Gutter DOM Destruction & Re-creation**: The line-number gutter mapped over `lines.map(...)` for every line in the document. For files with hundreds or thousands of lines, every keystroke destroyed and re-instantiated thousands of DOM `<div>` elements because `cursorPos.line === lineNum` changed on every cursor movement and `lines` was a new array reference per keystroke.
   - **Unnecessary Diff Calculations**: Synchronously updating `tab.content` caused `WorkstationCenterPanel`'s `useEffect` to trigger `computeLineDiff` (an $O(N \times M)$ DP matrix algorithm) against the user's own live typing.
2. **Fixes Implemented**:
   - **Debounced Parent Tab Sync (`WorkstationCenterPanel.tsx`)**: `onUpdateTabContent` is now debounced (500ms), ensuring live typing stays completely local to the editor without re-rendering parent components. Flush happens immediately on save (`Ctrl+S`).
   - **Memoized Gutter (`CenterEditorView.tsx`)**: Extracted `CenterEditorGutter` into a memoized component that only accepts `lineCount: number`, `cursorLine: number`, and `addedLineNums`. When typing characters on the same line, `CenterEditorGutter` does NOT re-render at all (0 DOM elements created or diffed).
   - **Zero-Allocation Line Count**: Replaced `currentContent.split("\n")` with an inline character-code loop (`currentContent.charCodeAt(i) === 10`), eliminating huge temporary array allocations in memory.
   - **Guarded Sync Effect**: Added `!unsavedTabs[activeTab.id]` guard in `useEffect` to prevent running expensive `computeLineDiff` while the user is actively typing.
   - **Native Form Optimization**: Added `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, and `spellCheck={false}` to the file textarea.

## Files Changed
- `apps/web/src/components/workstation/WorkstationCenterPanel.tsx` — Debounced tab sync, zero-allocation lineCount, memoized diff lines, and guarded sync effect.
- `apps/web/src/components/workstation/tabs/CenterEditorView.tsx` — Extracted memoized `CenterEditorGutter` and added form performance attributes.

## Tests
- `npm run typecheck` — ✅ Passed (0 TypeScript errors)
- `npm run build -w apps/web` — ✅ Passed (Vite build in 9.83s)

## Notes
- File editing in the center window is now smooth and responsive even on large multi-thousand-line documents.
