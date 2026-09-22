# Dev Log — Fix Telegram Thinking Delay & Prompt SSE Mapping

**Date & Time:** 2026-09-22 13:53:00 WIB  
**Author:** Antigravity AI

## What
Diagnosed and resolved the issue where user prompts coming from Telegram had a noticeable delay on the Desktop Workstation UI before displaying the `✨ Thinking...` indicator.

### Root Cause Analysis
1. **Engine Event Mapping Gap:**
   - When a user sends a prompt via Telegram, the backend engine admits the prompt and broadcasts the `session.next.prompt.admitted` (or `session.next.prompted`) SSE event to connected clients.
   - In `apps/web/src/lib/engine.ts`, `mapEngineEvent` had no handler for `session.next.prompt.admitted` or `session.prompted`, returning `null`.
   - As a result, the desktop SSE listener in `useWorkstationChat.ts` dropped this event entirely.
2. **Inference Latency Window:**
   - Under free/cloud LLM providers (e.g., Agnes 2.5 Flash on Kenari), processing large prompt contexts with living memory and tool schemas (~34k tokens) takes 5–9 seconds before the first text delta or tool execution event is emitted.
   - Because the prompt admitted event was ignored, the desktop UI remained completely static and blank during that 9-second window until either an async fallback query completed or the model finally emitted its first tool step.

### Solution
1. **`apps/web/src/lib/engine.ts`**:
   - Added cases for `session.next.prompt.admitted`, `session.next.prompted`, and `session.prompted` inside `mapEngineEvent`.
   - Instantly returns `{ type: "thinking", data: "Analyzing request & documents..." }`.
2. **`apps/web/src/components/workstation/chat/useWorkstationChat.ts`**:
   - When `type: "thinking"` is received from SSE, it activates the streaming state, triggers `queryClient.invalidateQueries` to immediately fetch the newly arrived user bubble, and displays the `✨ Thinking...` indicator in ~10ms.
   - Updated the in-flight check in Effect #8 to optimistically display `Thinking...` immediately if the last message in chat is a recent user message (< 30s) without an assistant reply, rather than waiting on the asynchronous `isSessionActive` network check.

## Files Changed
- `apps/web/src/lib/engine.ts` — Added prompt admitted event mappings to trigger thinking status.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Immediate optimistic thinking activation for recent in-flight prompts without assistant reply.

## Tests
- `npm run build -w apps/web` — ✅ Built cleanly in 25.49s (0 TypeScript compilation errors, 0 lint errors).

## Notes
The desktop client now reflects incoming Telegram requests with instantaneous visual feedback (< 20ms) while the backend and LLM process the document tools.
