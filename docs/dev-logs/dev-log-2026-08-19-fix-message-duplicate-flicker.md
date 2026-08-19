# Dev Log — Eliminate Message Duplication Flicker on Stream Completion

**Date & Time:** 2026-08-19 18:04:30 WIB
**Author:** Antigravity AI

## What
Fixed the brief flicker where messages appeared twice after stream completion:
1. **Deduplication in `WorkstationRightChat.tsx`**:
   - `allMessages` now filters out optimistic messages that have already been persisted into `chatMessages` from the database query.
2. **Synchronous Invalidation Resolution**:
   - Removed the 400ms `setTimeout` delay in `UnifiedWorkstationPage.tsx`. Instead, `optimisticMessages` clears synchronously when query invalidation resolves.

## Files Changed
- `apps/web/src/components/workstation/WorkstationRightChat.tsx`
- `apps/web/src/pages/UnifiedWorkstationPage.tsx`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2200 modules transformed)
