# Dev Log — Active Turn Concurrency Lock Auto-Release Fix

**Date & Time:** 2026-08-14 11:47:29 WIB  
**Author:** Antigravity AI Software Engineer  

## What
Fixed the issue where users occasionally received `⚠️ Error: Another request is being processed. Please wait.` when sending a new message right after a previous turn completed or disconnected:
1. **Reduced `TURN_TIMEOUT_MS`**: Decreased turn timeout in [`user-turn-transcript.service.ts`](file:///e:/JS/Arunika/apps/api/src/modules/chat/user-turn-transcript.service.ts) from 300,000ms (5 minutes) to 25,000ms (25 seconds) so stuck turns do not linger.
2. **Auto-Release Stale Turns**: In [`chat.controller.ts`](file:///e:/JS/Arunika/apps/api/src/modules/chat/chat.controller.ts), if `hasActiveTurn(id)` returns a turn older than 10 seconds, it automatically calls `markFailed(activeTurn.runId)` to release the concurrency lock and allow the new message to process seamlessly.

## Files Changed
- `apps/api/src/modules/chat/user-turn-transcript.service.ts` — Reduced `TURN_TIMEOUT_MS` to 25s.
- `apps/api/src/modules/chat/chat.controller.ts` — Added auto-release for active turns older than 10s.

## Tests
- `npm run build` — ✅ Passed (NestJS & Vite built with 0 errors in 7.94s).
- `git commit` & `git push` — ✅ Successfully committed and pushed to `main` (`c83ebfa`).

## Notes
- Users can now send rapid follow-up messages without getting blocked by stale active turn locks.
