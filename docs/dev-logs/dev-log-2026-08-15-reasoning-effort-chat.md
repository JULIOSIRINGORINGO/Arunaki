# Dev Log — Reasoning Effort Selector + Speed Fix

**Date & Time:** 2026-08-15 WIB
**Author:** AI Software Engineer (opencode)

## What
1. **Speed fix (root cause):** removed the forced `reasoning_effort: 'medium'` for `deepseek-v4-flash` and reasoning-model auto-detect. DeepSeek V4 "thought" ~200s before first token when reasoning effort was forced; with natural effort round-1 LLM call dropped to ~7.5s and total runs dropped to 17–23s (target <40s met).
2. **Effort selector UI:** replaced the hardcoded `Workspace Agent` badge in the chat input bar with an effort dropdown (`Natural / Low / Medium / High`). Natural (empty) sends nothing to the provider; Low/Medium/High map to `openai.reasoningEffort`.
3. **Safety net:** model-level in-memory cooldown + 300s rotate cooldown, TTFB 20s + total 60s timeout → rotate provider on timeout.

## Files Changed
- `apps/web/src/components/workstation/WorkstationRightChat.tsx` — badge → effort dropdown
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — `reasoningEffort` state, sent in stream body
- `apps/api/src/modules/chat/chat.controller.ts` — accept `reasoningEffort`, pass to `AgentRunParams`
- `apps/api/src/modules/chat/agent-runner.service.ts` — plumb effort to `chatStream`/`chat`
- `apps/api/src/modules/ai/ai.service.ts` — `chat`/`chatStream` accept effort, forward to `buildProviderOptions`
- `apps/api/src/modules/ai/sdk-transformer.util.ts` — `buildProviderOptions` effort override
- `apps/api/src/modules/ai/model-capability.ts` — removed forced `reasoningEffort`, auto-detect adds `maxTokens: 8192` headroom
- `apps/api/src/modules/ai/model-fallback.ts` — rotate provider on timeout
- `apps/api/src/modules/ai/stream-chat.ts` — TTFB 20s + total 60s timeout
- `apps/api/src/modules/provider/provider.service.ts` — model-level cooldown + `buildActiveConfig` reorder
- `apps/api/src/modules/ai/stream-chat.spec.ts` — cooldown expectations (13/13 pass)
- `apps/api/scripts/test-rekap-extended.ts` — harness `[+Ns]` timing instrumentation
- `apps/api/src/prompts/rules.md` — prompt tweaks

## Tests
- `npx nest build` (api) — ✅ passed
- `npx tsc -b` (web) — ✅ passed
- `npx vitest run` (api) — ✅ 146 passed / 1 failed (`context-manager.spec.ts`, expected 14010 got 14160 — **pre-existing**, fails on clean tree, unrelated to this change)
- Harness runs (`node dist/scripts/test-rekap-extended.js`): run9 13.95s 17/17; re-runs 16.8s/18.3s/22.6s (16/17, 16/17, 17/17) — consistently <40s

## Notes
- Run timings include latency variance; ~14s was a fast deepseek response, real baseline 17–23s.
- Flaky template integrity remains: occasionally the model replaces `PAK ARNOL` row with `CI LISOI` inside `SISA PEMBAYARAN` section (16/17 runs). Not a speed issue.
- Effort dropdown only shows when an active workspace is selected (inherits old badge position).
- Committed: `c3598c0` → pushed to `origin/main`.
