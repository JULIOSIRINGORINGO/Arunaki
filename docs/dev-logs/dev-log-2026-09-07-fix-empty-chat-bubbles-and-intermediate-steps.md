# Dev Log — Fix Empty Chat Bubbles and Intermediate Step Fragmentation

**Date & Time:** 2026-09-07 19:21:00 WIB  
**Author:** Antigravity AI Software Engineer

## What
Fixed an issue where multi-step agent tool executions rendered numerous empty rounded message bubbles ("kotak kotak kosong") with repeated timestamps and "Thought for 1s" dropdowns:
1. **Empty Box Prevention in Bubble**: `ChatMessageBubble.tsx` previously evaluated whitespace-only content (such as `"\n\n\n"` emitted before tool calls) as truthy, rendering an empty rounded bubble card (`bg-[var(--bg-card)] border border-[var(--border-color)]`) and an empty action toolbar. Now, `displayContent` is strictly trimmed, and message card + action toolbar only render when there is actual visible content or image attachments. If a message has neither visible content nor thought/steps, the component safely returns `null`.
2. **Intermediate Message Aggregation in Engine Mapper**: In `mapper.ts`, multi-step agent executions in an assistant turn previously generated fragmented messages for every tool invocation. `mapEngineMessages` now:
   - Accurately parses tool calls (`type: "tool"` and `type: "tool-invocation"`) with tool names and arguments into `executionSteps`.
   - Aggregates consecutive assistant messages of the same turn into a single unified assistant response, combining reasoning in the thought badge, consolidating execution checklist steps, and outputting the full final content without any empty ghost bubbles.

## Files Changed
- `apps/web/src/components/workstation/chat/mapper.ts` — Updated tool extraction and added consecutive assistant message aggregation per turn.
- `apps/web/src/components/workstation/chat/ChatMessageBubble.tsx` — Prevented empty bubble and toolbar rendering when content is whitespace-only, and added guard against blank ghost elements.

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors)
- Verified with active session `ses_f844d3a7affe41GrH7Mi7aAN5e` data: 15 fragmented raw messages cleanly mapped to 4 unified conversation turns with 0 empty bubbles.

## Notes
- Solves user complaint: `"ini bug ui lagi? yang ada kotak kotak kosong?"`.
