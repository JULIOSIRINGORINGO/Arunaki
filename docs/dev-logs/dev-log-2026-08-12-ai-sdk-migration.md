# Dev Log — AI SDK Migration & Fallback Resilience

**Date & Time:** 2026-08-12 15:10:00 WIB
**Author:** Antigravity

## What
Full migration of the AI/LLM communication pipeline to Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) replacing manual `fetch` calls. This brings Arunaki to parity with Opencode's architecture for tool-calling and response parsing.

1. Switched `AiService` chat/stream implementations to use `generateText` and `streamText`.
2. Adapted the error handling in `model-fallback.ts` to natively consume `APICallError` instances from the SDK for reliable provider rotation.
3. Identified a rogue manual fetch implementation in `vision-ai.tool.ts` and successfully refactored it to use `createOpenAI()` and `generateText`.
4. Removed a decommissioned Groq model (`deepseek-r1-distill-llama-70b`) from the `ProviderCatalogService` fallback preset to prevent pipeline aborts.

## Files Changed
- `WORKFLOW.md` — Added Phase 45 for Full AI SDK Migration
- `apps/api/src/modules/ai/ai.service.ts` — Migrated to `generateText`, `streamText`
- `apps/api/src/modules/ai/model-fallback.ts` — Adapted error catching to `APICallError`
- `apps/api/src/modules/ai/stream-chat.ts` — Updated to consume AI SDK's stream chunks
- `apps/api/src/modules/provider/provider-catalog.service.ts` — Removed dead groq model
- `apps/api/src/modules/tools/services/vision-ai.tool.ts` — Migrated inference to AI SDK `generateText`

## Tests
- `npx nest build` — ✅ passed (clean compilation)
- `node --enable-source-maps dist/scripts/test-rekap-extended.js` — ✅ Tool calls and parameters parsed successfully via SDK integration.

## Notes
- `provider.controller.ts:166` retains a raw `fetch` specifically for lightweight API-key ping/connection-verification which is acceptable.
- With these updates, the core agent execution layer is now standard-compliant and isolated under the Vercel AI SDK contract.
