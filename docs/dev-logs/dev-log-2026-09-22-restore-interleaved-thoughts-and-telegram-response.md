# Dev Log — Restore Interleaved Thoughts per Tool Call & Resilient Telegram Polling

**Date & Time:** 2026-09-22 15:20:00 WIB  
**Author:** Antigravity AI Software Engineer

## What
Resolved two critical issues reported by the user:
1. **Collapsed Thoughts per Turn:** Previously, all thoughts and reasoning steps throughout a multi-step turn were consolidated into a single top-level `Thought: Xs` block, rather than appearing individually above each corresponding tool step. In addition, when tool execution events lacked explicit arguments on completion, labels like `Explored Completed read` and `Edited Failed edit` appeared because internal status strings were parsed as file names.
2. **Telegram Premature Fallback Response:** When complex operations required multiple tool steps (e.g. reading, multiple edits, calculations, and verification taking > 90 seconds), Telegram Gateway hit its rigid 90-second poll timeout (`maxPollAttempts = 75`) and sent `"Permintaan selesai diproses."` instead of waiting for the real, synthesized LLM answer.

## Key Changes
1. **`apps/web/src/components/workstation/chat/ChatMessageBubble.tsx`**:
   - Restored chronological interleaving of `msg.parts`.
   - Each reasoning phase produces its own `MessageThoughtBadge`, and consecutive tool calls within that phase group together into clean document task cards.
   - Preserved fallback rendering for turns with only top-level reasoning.
2. **`apps/web/src/components/workstation/LiveExecutionBadge.tsx`**:
   - In `formatToolStepLabel`, sanitized `argsOrTarget` to filter out status prefixes (`completed`, `failed`, `executing`, `running`, `preparing`). This permanently prevents bogus filenames like `Completed read` or `Failed edit`.
3. **`apps/web/src/components/workstation/chat/useWorkstationChat.ts`**:
   - On tool completion, preserved existing resolved file labels (e.g. converting `Reading LAPORAN-HARIAN.txt` $\to$ `Explored LAPORAN-HARIAN.txt`) when completion events omit argument payloads.
4. **`packages/engine/engine/src/messaging/telegram.ts`**:
   - Extended `maxPollAttempts` from 75 to 200 (~240 seconds default).
   - Added dynamic poll extension (up to 350 cycles) if the engine session is still actively running tools (`isSessionBusy === true`), so heavy document tasks never timeout prematurely.
   - Enforced that responses only finalize if the LLM explicitly signals completion (`finish === "stop"`) or the session has been genuinely idle for $\ge 3$ cycles without pending `tool-calls`.
   - Added a final database message check before fallback so the actual assistant response is captured and sent to Telegram.

## Verification
- `npm run build -w apps/web`: ✅ Passed cleanly (built in 38.20s with 0 TypeScript/compilation errors).
- Tested `formatToolStepLabel` with status strings: verified target remains empty instead of emitting `Explored Completed read`.
