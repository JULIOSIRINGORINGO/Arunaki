# Dev Log — Fix New Chat Session Creation and URL Loop

**Date & Time:** 2026-09-05 18:42:00 WIB
**Author:** AI Software Engineer (Antigravity)

## What
Fixed the issue where clicking the `+` (New Chat) button did not create a new conversation and left old chat messages stuck on the screen:
1. **Root Cause**:
   - `UnifiedWorkstationPage.tsx` had a bidirectional `useEffect` syncing `urlChatId` and `activeChatId`. When `handleNewChat` reset `activeChatId` to `""`, the URL parameter `chatId` was still set to the old session ID. The effect saw `urlChatId && urlChatId !== activeChatId` and immediately reverted `activeChatId` back to the old session ID, reloading the previous messages.
2. **Fix in `UnifiedWorkstationPage.tsx`**:
   - Split external URL sync and internal state sync using a reference ref (`prevUrlChatIdRef`).
   - When `activeChatId` changes to a new ID or is cleared, the URL `chatId` query parameter and `localStorage` are updated accordingly (`delete("chatId")` or `set("chatId", id)`).
   - Ensured `openFolder` clears `chatId` from search params so opening a folder always starts cleanly.
3. **Fix in `useWorkstationChat.ts`**:
   - Updated `handleNewChat` to abort any active stream, reset optimistic state and live telemetry.
   - Proactively calls `createSession` to create a real new session on the engine backend immediately.
   - Sets the query cache for `["chat-messages", session.id]` to `[]` and invalidates `["sessions"]` so the new conversation immediately renders a blank, clean chat state.

## Files Changed
- `apps/web/src/pages/UnifiedWorkstationPage.tsx`
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts`

## Tests & Verification
- `npm run build -w apps/web` — ✅ passed (exit code 0, 0 TypeScript errors).
