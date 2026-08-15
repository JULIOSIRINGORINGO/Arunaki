# Dev Log — Universal Model Robustness & Self-Correction Harness

**Date & Time:** 2026-08-16 00:39:00 WIB
**Author:** Antigravity

## What
Refactored the Agent Harness and Prompt Engine to ensure complete robustness and flexibility across all model tiers (from small 7B/20B models and cheap 120B open-weights models to frontier models) without hardcoding any model-specific assumptions.

1. **Autonomous Self-Correction & Nudge Loop (`workspace-runner.service.ts`)**:
   - Intercepted rounds where a model returns 0 tool calls during a file mutation task on early rounds.
   - Automatically injected `[System Action Required]` steering nudges and continued the execution loop (up to 2 autonomous recovery attempts) rather than prematurely quitting with `done`.
   - Added automatic non-streaming fallback recovery when streams produce empty content.

2. **4-Tier Resilient File Matching (`edit-tool.service.ts`)**:
   - 1st Tier: Exact String Match.
   - 2nd Tier: CRLF Normalized Match.
   - 3rd Tier: Line-Number Stripped Match (`^\s*\d+:\s*`) so pre-read line numbers never block replacements.
   - 4th Tier: Whitespace-Tolerant Block Match so minor spacing variations match cleanly.

3. **Stream Accumulation in `makeSdkRequest` (`sdk-transformer.util.ts`)**:
   - For OpenAI-compatible endpoints that reject non-streaming `generateText` or return empty JSON (like Kenari), `makeSdkRequest` seamlessly accumulates tokens and tool calls via `makeSdkRequestStream`.

4. **Model-Agnostic Prompt Anchoring (`model-router.service.ts`)**:
   - Added generic few-shot JSON invocation examples for open-weights models.
   - Explicitly instructed models never to output line numbers inside `oldString` or `newString`.

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Added self-correction nudge loop and empty-stream recovery.
- `apps/api/src/modules/tools/services/edit-tool.service.ts` — Added 4-tier match fallback and whitespace-tolerant block search.
- `apps/api/src/modules/ai/sdk-transformer.util.ts` — Added stream accumulation fallback inside `makeSdkRequest`.
- `apps/api/src/modules/ai/model-router.service.ts` — Added model-agnostic few-shot examples and line-number instructions.
- `WORKFLOW.md` — Added Phase 47 checklist.

## Tests
- `npx vitest run apps/api/test/tool-call-repair.spec.ts` — ✅ Passed (7/7 tests in 13ms)
- `npm run build -w apps/api` — ✅ Passed (Nest API build 0 errors)
- `apps/api/scripts/test-kenari-direct.ts` — ✅ Direct streaming test on `gpt-oss-120b` completed in 1.4s (103 chunks)

## Notes
The entire self-correction and match-healing system is 100% dynamic and model-agnostic. Any model connected now or in the future will benefit from automatic action nudging and fuzzy patch matching.
