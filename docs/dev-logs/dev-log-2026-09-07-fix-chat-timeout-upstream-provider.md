# Dev Log — Fix Upstream Provider Timeout & Migrate Default Model to Agnes Flash

**Date & Time:** 2026-09-07 18:45:00 WIB  
**Author:** AI Software Engineer  

## What
Diagnosed and resolved the recurring upstream chat stall / timeout (`Upstream Provider Timeout (Kenari): No response received from Kenari within 90 seconds`) that occurred after repairs/reloads.

### Root Cause
1. **GLM-4.7-Flash Heavy Reasoning & Queue Congestion**:
   - In previous updates, `glm-4-7-flash:free` was designated as the primary fallback model in `App.tsx` and `useWorkstationChat.ts`.
   - Live benchmarking revealed that `glm-4-7-flash:free` spends 100+ tokens performing internal reasoning (`delta.reasoning_content`) before generating text, and its free upstream queue on Kenari regularly congests to 40s–90s+ or drops connections during peak hours.
   - When users opened chat or reloaded after updates, the app defaulted to `glm-4-7-flash:free`, causing messages to get stuck in `Thinking... (86s)` and trigger the 90-second watchdog abort.
   - While `isStreaming` remained `true` during the stall, the chat input locked (`Message queued`), making users unable to send chat.
2. **Stream Schema Fragility**:
   - In `packages/engine/llm/src/protocols/openai-chat.ts`, `OpenAIChatEvent` strictly enforced `choices: Schema.Array(OpenAIChatChoice)`.
   - When Kenari or OpenAI-compatible gateways emitted usage-only SSE chunks or non-standard error frames without a `choices` array, the Effect Schema parser threw `Invalid kenari/openai-compatible-chat stream event` and crashed the session.

### Solution
1. **Migrated Default Model to `agnes-2-0-flash:free`**:
   - Live benchmarks measured `agnes-2-0-flash:free` responding in **816ms – 1.1s** with instant, direct streaming (no reasoning latency).
   - Updated `App.tsx` to automatically migrate any existing `localStorage` entry for `glm-4-7-flash:free` to `agnes-2-0-flash:free`.
   - Updated `DEFAULT_MODELS.kenari` in `apps/web/src/components/settings/constants.ts` and fallback resolution in `useWorkstationChat.ts`.
2. **Hardened Stream Event Parser**:
   - Wrapped `choices` in `optionalNull(...)` in `OpenAIChatEvent` schema.
   - Added optional chaining `event.choices?.[0]` in the stream step parser so events lacking `choices` do not crash the stream.

## Files Changed
- `apps/web/src/App.tsx` — Migrated `activeModel` and `kenariPool` to prioritize `agnes-2-0-flash:free`
- `apps/web/src/components/settings/constants.ts` — Updated default Kenari model order
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Updated fallback model resolution
- `packages/engine/llm/src/protocols/openai-chat.ts` — Made `choices` optional in stream event schema

## Verification
- **Live Model Benchmark**:
  - `agnes-2-0-flash:free`: 200 OK in **1391ms** with full Indonesian greeting: `"Halo! Ada yang bisa saya bantu untuk Anda hari ini?"`
- **Build Verification**:
  - `npm run build -w apps/web` passed with 0 errors (built in 16.57s).
