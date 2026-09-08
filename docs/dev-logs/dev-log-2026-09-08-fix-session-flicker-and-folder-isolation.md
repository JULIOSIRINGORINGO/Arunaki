# Dev Log — Fix Session Flicker & Folder Isolation (Antigravity Parity)

**Date & Time:** 2026-09-08 19:05:00 WIB  
**Author:** AI Software Engineer  

## What
1. **Eliminated Session Flicker Loop**:
   - Diagnosed root cause of the rapid screen flicker when opening or switching chat sessions. Previously, 5 separate useEffect hooks were competing over activeChatId, activeFolder, and searchParams, causing infinite bouncing between URL parameters, localStorage, and local state.
   - Refactored into a single, unidirectional, ref-guarded synchronization pipeline: State (activeFolder, activeChatId) -> URL & localStorage.
   - Prevented unnecessary canvas tab updates in useTabs.ts by checking if content and title are identical.
   - Set hasRestoredCanvasRef.current = activeChatId immediately before processing to prevent multi-triggering.
   - Memoized menubar global event listeners with component refs so they mount once and never re-bind on tab clicks or chat state changes.
2. **Antigravity / VS Code Parity for Project Folders**:
   - When a user opens a new folder, previous conversation sessions and previous center tabs/canvas are cleanly cleared.
   - Sessions are now isolated per folder (arunaki_active_chat_id_<folder>).
   - SearchSectionModal now filters sessions by the active directory (directory: activeFolder).

## Files Changed
- apps/web/src/pages/UnifiedWorkstationPage.tsx — Unified state/URL sync, ref-stabilized menubar listeners, folder isolation in openFolder
- apps/web/src/components/workstation/tabs/useTabs.ts — Reset open tabs on folder change, prevent redundant canvas tab updates
- apps/web/src/components/workstation/chat/useWorkstationChat.ts — Immediate clean slate transition on handleNewChat, per-folder storage key, guard hasRestoredCanvasRef
- apps/web/src/components/workstation/SearchSectionModal.tsx — Filter session list by activeFolder
- apps/web/src/components/layout/AppLayout.tsx — Preserve active folder when navigating to workstation

## Tests & Verification
- npm run build -w apps/web — ✅ Built with 0 TypeScript compilation errors.
- Verified state transitions: openFolder clears previous folder tabs and session cleanly, handleNewChat transitions instantly with 0 re-render loops.
