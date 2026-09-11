# Dev Log — Session Message Pagination & Default Limit Truncation Fix

**Date & Time:** 2026-09-11 20:23:00 WIB  
**Author:** Antigravity AI Software Engineer

## What
- Diagnosed and fixed critical bug where messages (such as "ganti 75" and subsequent assistant replies) disappeared upon completion and the chat view jumped back to the 50th message ("BELANJA LABURA").
- Root cause:
  - Backend engine `/api/session/:id/message` has `DefaultMessagesLimit = 50`.
  - Frontend `getMessages()` previously called `/api/session/:id/message?order=asc` without `limit` or pagination.
  - When the session grew to 59 messages, the backend truncated messages 51-59, returning only the first 50 oldest messages.
  - Upon completion, `setOptimisticMessages([])` cleared the optimistic state and replaced it with the 50 messages from the backend, causing messages 51-59 to vanish from the screen.
- Solution:
  - Updated `getMessages()` in `apps/web/src/lib/engine.ts` to request `limit: 200` (max allowed by schema) and automatically follow `cursor.next` pagination up to 1000 messages.
  - Added chronological timestamp sorting and filtered out internal `compaction` messages in `apps/web/src/components/workstation/chat/mapper.ts`.

## Files Changed
- `apps/web/src/lib/engine.ts` — Added cursor pagination and `limit: 200` to `getMessages`.
- `apps/web/src/components/workstation/chat/mapper.ts` — Added chronological sorting and compaction filtering.

## Tests
- `npm run build -w apps/web` — ✅ PASSED (0 errors, 12.59s).
- Live Browser E2E Inspection — ✅ PASSED (Verified in `ganti_75_restored_1789132929121.png` showing `ganti 75`, tool execution cards, and assistant response).
