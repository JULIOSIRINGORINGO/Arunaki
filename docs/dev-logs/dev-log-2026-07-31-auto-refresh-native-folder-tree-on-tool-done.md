# Dev Log — Auto-Refresh Native Folder Tree on Tool Execution

**Date & Time:** 2026-07-31 12:51 WIB
**Author:** Antigravity

## What
Resolved issue where deleted or newly created files remained in the right sidebar folder tree UI until the user manually clicked the Refresh button.

## Root Cause Analysis
1. Upon SSE `tool_done` or `done` events, `WorkspacePage.tsx` previously invalidated React Query cache for `wsFiles` (`queryClient.invalidateQueries({ queryKey: ["wsFiles", wsId] })`).
2. However, in Electron desktop mode, the right sidebar folder tree is powered by `nativeTree` state (populated via native Electron `desktop.getFolderTree(rootPath)` scan).
3. Because `handleRefreshFolder()` was not triggered automatically on SSE tool completion, `nativeTree` retained stale file references until manual refresh was triggered.

## Fixes Implemented
1. **`WorkspacePage.tsx` (`apps/web/src/pages/WorkspacePage.tsx`):**
   - Added `refreshFolderQuietly` helper function that quietly re-scans the Electron native folder tree (`desktop.getFolderTree(rootPath)`) without showing intrusive toast messages.
   - Connected `refreshFolderRef.current(wsId)` to SSE `tool_done` and `done` event handlers.
   - Guaranteed that whenever `delete_workspace_file` or `write_workspace_file` finishes, the right sidebar folder tree UI updates immediately and automatically in real-time.

## Verification
- TypeScript compilation clean (0 errors).
- Native folder tree auto-refreshes seamlessly on file mutation.
