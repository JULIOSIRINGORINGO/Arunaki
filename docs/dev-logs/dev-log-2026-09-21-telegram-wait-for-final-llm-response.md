# Dev Log — Telegram Poller Waits for Final LLM Text Response

**Date & Time:** 2026-09-21 19:16:00 WIB  
**Author:** Antigravity AI Software Engineer

## What
- Fixed an issue where the Telegram bot prematurely replied with intermediate tool status (`✅ Berhasil memproses dokumen: • read`) during multi-step executions instead of waiting for Arunaki's actual, complete LLM text response.
- In `extractAssistantReply`, eliminated all dummy tool success list formatting. The function now exclusively extracts genuine LLM assistant text.
- In `executeArunakiPrompt`, updated the polling loop:
  - Added session active check against `/api/session/active`. The poller will not prematurely finalize while the engine is still executing subsequent tool steps.
  - The poller now collects all assistant text created for the prompt turn and waits until execution has completed (`!isSessionBusy` or `finish === "stop"`).
  - Only genuine, full LLM text answers are sent back to Telegram.

## Files Changed
- `packages/engine/engine/src/messaging/telegram.ts` — Refactored `extractAssistantReply` and the `executeArunakiPrompt` polling loop to wait for final LLM text responses.

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, built in 13.50s).
- Verified message data and text extraction against SQLite engine message records.
