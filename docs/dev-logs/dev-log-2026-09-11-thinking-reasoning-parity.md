# Dev Log — Thinking/Reasoning Parity & Multi-Step Streaming Fix

**Date & Time:** 2026-09-11 18:33:00 WIB
**Author:** AI Agent (Antigravity)

## What
Fixed two critical streaming bugs in the Arunaki chat UI:

1. **Multi-step streaming continuity**: When the engine runs a multi-step turn (reasoning → text → tool → reasoning → text), the UI would go silent between steps. The second step's thinking indicator wouldn't appear, and the answer would pop in without live streaming.

2. **Step 1 answer disappearing**: When step 2 started streaming, the `<think>` tag extraction logic would split the entire accumulated text and discard step 1's answer content.

### Root Causes
- **Bug 1**: `session.next.step.ended` with `finish: "tool-calls"` was mapped to `done` event, causing `finalizeDone()` to fire prematurely. The UI thought the conversation was over.
- **Bug 2**: The `<think>` tag extraction used `split("</think>")` which destructively split the entire accumulated response text, discarding all content before the `<think>` tag (including step 1's answer).

### Fixes
- Added `step_continuation` event type for tool-call continuations (distinct from `done`)
- Implemented regex-based `<think>` extraction that preserves all non-think content
- Fixed deduplication logic in `WorkstationRightChat` to keep active streaming bubbles visible
- Added `reasoning_effort: "high"` injection for deep-reasoning model support

## Files Changed
- `apps/web/src/lib/engine.ts` — Added `step_continuation` event mapping, `directory` param to SSE
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Multi-step streaming handlers, regex think extraction, step_continuation support
- `apps/web/src/components/workstation/WorkstationRightChat.tsx` — Deduplication fix for active streaming bubbles
- `apps/web/src/components/workstation/chat/mapper.ts` — Regex-based think extraction for persisted messages
- `apps/web/src/components/workstation/chat/ChatInputBox.tsx` — Minor UI fix
- `packages/engine/core/src/session/runner/llm.ts` — Step.Ended event emission improvements
- `packages/engine/core/src/session/runner/model.ts` — Reasoning effort variant synthesis
- `packages/engine/llm/src/protocols/openai-chat.ts` — Reasoning content field support
- `packages/engine/llm/src/protocols/utils/openai-options.ts` — Reasoning effort injection

## Tests
- `npm run typecheck` — ✅ passed (0 errors)
- `npm run build -w apps/web` — ✅ passed (22.41s, 0 errors)
- Manual verification in browser — Multi-step conversations now show both answers

## Notes
- The `<think>` tag extraction is a fallback for models that embed reasoning in content text (e.g., DeepSeek). Models using native reasoning streams (Claude Thinking) use the `reasoning_delta`/`reasoning_end` event path instead.
- The chunk size warning (9.2MB index.js) is pre-existing and unrelated to this change.
