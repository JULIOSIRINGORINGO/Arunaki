# Dev Log — Telegram Desktop Session Unification & Async Response Polling

**Date & Time:** 2026-09-21 18:52:00 WIB  
**Author:** Antigravity AI

## What
Resolved issues where messages sent from Telegram were not appearing in the desktop Arunaki chat history and replies to Telegram were prematurely returning empty fallback messages:
1. **Endpoint Resolution**: Restored the prompt endpoint URL to `/api/session/:sessionID/prompt` (v2 protocol admission endpoint).
2. **Async Agent Loop Polling**: Replaced the 600ms premature timeout with a resilient 90-second polling loop against `/api/session/:sessionID/message`. The gateway periodically sends Telegram typing indicators while the AI executes multi-step tools (e.g., Python openpyxl, Excel/text updates) and returns the actual final assistant response text to Telegram.
3. **Session Unification & Real-Time Desktop Sync**:
   - Added `activeFolderSessionMap` and `setActiveSession` to `TelegramService`.
   - Exposed `POST /api/messaging/active-session` in `MessagingApi` and `messagingHandlers`.
   - Updated `UnifiedWorkstationPage.tsx` to automatically register the active desktop chat ID with the messaging gateway. When instructions are forwarded via Telegram, they route directly into the active desktop chat session, allowing the user to see the prompts, tool progress, and AI responses live on the workstation screen.
   - Added automatic title updates so Telegram-originated conversations receive clear descriptive titles in Chat History and Session Search.

## Files Changed
- `packages/engine/engine/src/messaging/telegram.ts` — Added `activeFolderSessionMap`, `setActiveSession`, restored `/prompt` endpoint, and implemented 90s response polling loop with live typing indicator.
- `packages/engine/engine/src/server/routes/instance/httpapi/groups/messaging.ts` — Defined `ActiveSessionPayload` schema and `setActiveSession` endpoint.
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/messaging.ts` — Implemented `setActiveSession` handler delegating to `telegramService`.
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — Synchronized active workstation session with messaging gateway on session/folder change.

## Tests
- `bun test packages/engine/engine/test/messaging/telegram.test.ts` — ✅ 14 pass, 0 fail.
- `npm run build -w apps/web` — ✅ 0 TypeScript errors, Vite bundle succeeded in 11.78s.
- Live test script `test_prompt_and_poll.ts` — ✅ Verified multi-turn document execution with tool calls and completed assistant reply.

## Notes
Dev app restarted cleanly (`npm run dev:app`). Services running on ports 4096 (Engine), 5173 (Vite), and Electron desktop shell.
