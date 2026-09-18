# Dev Log — Global UI Performance & Lightweight Architecture Optimization

**Date & Time:** 2026-09-18 10:00:00 WIB  
**Author:** Antigravity AI Software Engineer  

## What
Performed an end-to-end performance hardening across all workstation UI panels and layout layers to make the application super lightweight:
1. **Chat Markdown & Data Table Rendering Optimization (`ChatMessageContent.tsx`)**:
   - Hoisted `MARKDOWN_COMPONENTS` and `CELL_MARKDOWN_COMPONENTS` statically outside the component tree. Previously, a new inline components object was instantiated on every single render and for every cell, forcing `react-markdown` to invalidate its internal AST cache and rebuild the DOM tree.
   - Added a zero-overhead fast-path for table cells: cells without markdown syntax (`*`, `` ` ``, `_`, `[`) render directly as plain text without mounting the React-Markdown parser pipeline. For large tables, this eliminates hundreds of AST parsing cycles per frame.
2. **Explorer File Mapping Memoization (`WorkstationLeftExplorer.tsx`)**:
   - Wrapped `apiFiles` array transformation in `useMemo([workspaceFiles])`, preventing repeated O(N) object allocations on every render cycle.
3. **Top Navigation Bar Memoization (`TopMenuBar.tsx`)**:
   - Wrapped `TopMenuBar` with `React.memo` to isolate it from route, theme, or modal state changes in parent layouts.
4. **AppLayout Network Polling Decommissioning (`AppLayout.tsx`)**:
   - Removed the 5-second `setInterval` that repeatedly polled `navigator.onLine`, relying purely on reactive native browser events (`online`, `offline`) and eliminating unnecessary event loop wakeups.
5. **Cross-Panel Render Decoupling in Workstation (`UnifiedWorkstationPage.tsx`)**:
   - Memoized panel toggle/close handlers (`handleCloseLeft`, `handleToggleLeft`, `handleToggleRight`, `handleCloseFolderAction`, `handleSelectSessionAction`, modal openers/closers) with `useCallback`.
   - Prevented cross-panel re-renders: interactions in the left explorer or right chat no longer invalidate props on sibling panels.

## Files Changed
- `apps/web/src/components/workstation/chat/ChatMessageContent.tsx` — hoisted markdown components and added plain text fast-path for table cells
- `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx` — memoized `apiFiles`
- `apps/web/src/components/layout/TopMenuBar.tsx` — wrapped with `memo`
- `apps/web/src/components/layout/AppLayout.tsx` — removed 5-second network interval poller
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — memoized panel callbacks to prevent cross-panel re-rendering cascades

## Tests & Verification
- `npm run typecheck`: ✅ passed (0 errors)
- `npm run build -w apps/web`: ✅ passed (built in 11.46s)
