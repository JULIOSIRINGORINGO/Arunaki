# Dev Log — Realtime Execution Indicator & Thought Duration Sync for Telegram Prompts

**Date & Time:** 2026-09-21 19:09:00 WIB  
**Author:** Antigravity AI Software Engineer

## What
- Fixed missing live activity telemetry on desktop UI when prompts are initiated externally via Telegram. Previously, `useWorkstationChat` only listened to SSE during local `handleSendMessage`, leaving the workstation screen completely passive and static while an external Telegram prompt was processing.
- Added a persistent background SSE subscriber and status watchdog in `useWorkstationChat` that captures running prompts, live tool execution (`tool_start`, `tool_live_status`, `tool_preparing`), and active thinking telemetry regardless of where the prompt originated.
- Fixed confusing milliseconds display (`Thought: 182ms`) in `MessageThoughtBadge`. Duration now cleanly prioritizes seconds (`Xs` or `X.Xs`) and never exposes raw internal millisecond numbers to the user.
- Consolidated `partGroups` in `ChatMessageBubble` so multiple tool steps in a single assistant turn are rendered as a clean, unified document tasks card (`Executed N document tasks N/N` or `Executing N document tasks... X/N`) instead of dozens of stacked fragmented cards.

## Files Changed
- `apps/web/src/components/workstation/LiveExecutionBadge.tsx` — Formatted duration strictly in seconds (`Xs`), removing confusing millisecond fallback branch.
- `apps/web/src/components/workstation/chat/ChatMessageBubble.tsx` — Consolidated alternating thought/tool parts into unified thought, tasks card, and response bubble.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Added persistent background SSE event subscription, local vs external execution tracking (`isLocalSendingRef`), and live execution status synchronization.
- `apps/web/src/lib/engine.ts` — Mapped `session.status` (busy/idle) and `session.idle` events to trigger active UI streaming states.

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, built in 12.63s).
- Verified `git diff` clean and conformant with React Rules of Hooks.

## Notes
- All desktop execution badges strictly follow Cursor / Antigravity UX parity guidelines.
