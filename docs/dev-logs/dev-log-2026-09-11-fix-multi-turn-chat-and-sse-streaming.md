# Dev Log — Fix Multi-Turn Web Chat and SSE Streaming Settlement

**Date & Time:** 2026-09-11 11:22:00 WIB  
**Author:** AI Software Engineer  

## What
Diagnosed and resolved the root cause of why sending messages in the web Workstation stopped after the first turn or got stuck in the Message Queue forever. Verified with automated browser testing across 3 consecutive turns ("halo" -> "hitung 25 + 75" -> "sebutkan 3 warna pelangi") that full streaming, thought traces, finalization, message deduplication, and input readiness work seamlessly without reload.

### Root Causes & Fixes:
1. **Engine Provider Finish Reason Undefined (`packages/engine/llm/src/protocols/openai-chat.ts`)**:
   - OpenAI/Kenari providers frequently omit `finish_reason` in streaming deltas or stream it as null.
   - `finishEvents` in `openai-chat.ts` previously checked `if (reason) Lifecycle.finish(...)`. When `reason` was undefined, `Lifecycle.finish` was never executed and `stepSettlement` was never populated, preventing the turn from properly finishing.
   - **Fix**: Defaulted `reason` to `"stop"` if undefined (`(state.finishReason === "stop" && hasToolCalls ? "tool-calls" : state.finishReason) ?? "stop"`).

2. **Engine Server SSE Schema Encoding Crash (`packages/engine/server/src/handlers/event.ts`)**:
   - `Schema.encodeUnknownSync(ArunakiEvent)(data)` in `eventData()` threw uncaught errors on certain events (e.g. durable sequence formats), terminating the entire SSE HTTP connection.
   - **Fix**: Wrapped encoding in `try-catch` with raw payload fallback so the SSE connection stays alive continuously.

3. **Web Client Durable Event Normalization (`apps/web/src/lib/engine.ts`)**:
   - `mapEngineEvent()` didn't normalize durable versioned event tags (e.g. `session.next.text.ended.1`, `session.next.step.ended.2`), causing the frontend to ignore turn completion events.
   - **Fix**: Added `const normalizedType = event.type ? event.type.replace(/\.\d+$/, "") : ""` to map all versioned durable events cleanly.

4. **Web Chat Queue & Streaming State Desync (`apps/web/src/components/workstation/chat/useWorkstationChat.ts`)**:
   - When finalizing turns, `isStreamingRef.current` was not reset in lockstep with `setIsStreaming(false)`, causing `processNext()` to abort queued prompt processing.
   - Extracted unified `setStreamingState(val)` and `finalizeDone()` with a safe 600ms fallback debounce on `text_end` for purely conversational turns without tools.
   - Ensured completed tool steps correctly transition to `status: "completed"` so execution badges never hang indefinitely.

5. **Serve-Only Async Handling (`packages/engine/engine/src/serve-only.ts`)**:
   - Replaced sync `cli.parse()` with `await cli.parseAsync()` to prevent early exit when starting the engine server.

## Files Changed
- `packages/engine/llm/src/protocols/openai-chat.ts` — Default missing provider `finish_reason` to `"stop"`.
- `packages/engine/server/src/handlers/event.ts` — Safe SSE event JSON encoding with error fallback.
- `packages/engine/engine/src/serve-only.ts` — Use `parseAsync` for yargs CLI startup.
- `apps/web/src/lib/engine.ts` — Normalized durable versioned event types.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Unified `finalizeDone()`, synchronized `isStreamingRef`, and robust tool settlement.

## Tests & Verification
- `Playwright Headless Browser Test` (Chromium):
  - Turn 1 ("halo") -> Answered and finalized cleanly (`✓ Turn 1 finalized at T+8s`).
  - Turn 2 ("hitung 25 + 75") -> Answered "25 + 75 = 100" and finalized cleanly (`✓ Turn 2 finalized at T+5s`).
  - Turn 3 ("sebutkan 3 warna pelangi") -> Answered 3 rainbow colors and finalized cleanly (`✓ Turn 3 finalized at T+10s`).
  - Proof Screenshots captured: `web_two_turns_complete_proof.png` and `web_three_turns_complete_proof.png`.
- `npm run build -w apps/web` -> Built cleanly in 14.63s with 0 TypeScript compilation errors.
- `GET /api/health` -> Responds `{ healthy: true }` (HTTP 200).

## Status
✅ PASSED — Multi-turn chat is fully operational and rock-solid.
