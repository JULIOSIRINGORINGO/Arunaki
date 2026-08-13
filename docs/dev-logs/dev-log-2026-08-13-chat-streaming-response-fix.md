# Dev Log — Elimination of Trailing Duplicate User Message After Streaming

**Date & Time:** 2026-08-13 18:52:00 WIB
**Author:** Antigravity AI

## What
Identified and fixed the issue where the user message ("halo") appeared a second time at the bottom of the chat list after streaming completed.

### Root Cause
In `WorkstationRightChat.tsx`, `allMessages` concatenated `[...chatMessages, ...uniqueOptimistic]`. When `isStreaming` finished, `chatMessages` already contained the user message stored in DB. If `optimisticMessages` had not finished unmounting or clearing yet, `uniqueOptimistic` appended the optimistic user message *after* the assistant message in `chatMessages`, causing a trailing duplicate user bubble at the bottom.

### Fixes Applied
1. **`apps/web/src/components/workstation/WorkstationRightChat.tsx`**:
   - Updated `allMessages` logic:
     - While `isStreaming === true`: displays `chatMessages` + live non-duplicate `optimisticMessages`.
     - When `isStreaming === false`: switches directly to `chatMessages` from DB (or `optimisticMessages` if `chatMessages` is empty).
2. **`apps/web/src/pages/UnifiedWorkstationPage.tsx`**:
   - Immediately clears `optimisticMessages` (`setOptimisticMessages([])`) on `done` stream event.

## Verification
- `npm run build` (apps/web) — ✅ Passed (8.10s)
- `npx nest build` (apps/api) — ✅ Passed
