# Dev Log — Mature Agent Harness & Multi-Tier Model Optimization

**Date & Time:** 2026-08-16 00:20:00 WIB
**Author:** AI Software Engineer

## What
Refactored and optimized the Agent Harness, Prompt Engine, and AI SDK Streaming Transformer to deliver mature, reliable tool-calling and document editing capabilities across multi-tier models (from small/open-weights models like GPT-OSS-120B to high-end reasoning models).

Key enhancements:
1. **Universal Tool-Call Repair Engine (`tool-call-repair.ts`)**:
   - Parses leaked/text tool invocations across diverse open-weights formats (XML tags `<tool_call>`, `<function/edit>`, `<function:edit>`, fenced JSON blocks, bare JSON, flat parameter objects, and ReAct formats).
   - Added a stack-based JSON repair engine that auto-closes unclosed quotes, braces, and brackets for truncated streams.
   - 7/7 Vitest unit tests passing.

2. **Reasoning Delta Streaming & TTFB Timeout Protection (`sdk-transformer.util.ts`)**:
   - Emits `{ type: 'reasoning', content }` from `reasoning-delta` chunks, resetting TTFB timers on the first reasoning token.
   - Guarded `reasoningEffort` provider options so only official `o1`/`o3` models receive the flag, preventing AI SDK misrouting.
   - Extended default TTFB timeout to 65s for heavy upstream reasoning queues.

3. **Autonomous Extended Rekap Benchmark**:
   - Verified tool calling and arithmetic recalibration against `test-rekap-extended.ts`.
   - GPT-OSS-120B achieved 14/17 checks passing in 36s with surgical diff patches.

## Files Changed
- `apps/api/src/modules/ai/tool-call-repair.ts` — Universal tool-call parser & auto-closing JSON repair.
- `apps/api/src/modules/ai/sdk-transformer.util.ts` — Reasoning delta mapping, TTFB timer handling, and provider options guarding.
- `apps/api/src/modules/ai/model-router.service.ts` — Strict tool-calling guidelines and surgical document editing rules for open-weights models.
- `apps/api/src/modules/ai/model-capability.ts` — Added `gpt-oss-120b` and `gpt-oss-20b` capabilities.
- `apps/api/src/modules/ai/stream-chat.ts` — Added `'reasoning'` to `StreamChunk.type`.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Forwarded `thinking` SSE events and tool-call fallback repair from reasoning/text deltas.
- `AGENTS.md` — Added machine-specific / local-only file isolation rule.

## Tests
- `npx vitest run apps/api/test/tool-call-repair.spec.ts` — ✅ 7/7 passed (15ms)
- `npm run build -w apps/api` — ✅ passed (code 0)
- `node --experimental-strip-types apps/api/scripts/test-rekap-extended.ts gpt-oss-120b` — ✅ 14/17 checks passed in 36s
