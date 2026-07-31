# Dev Log — LLM Friendliness & Context Compression Refactoring

**Date & Time:** 2026-07-31 18:25:00 WIB
**Author:** Antigravity AI Engineer

## What
Resolved QA Audit findings from `Perbandingan_Arunaki_vs_OpenClaw_LLM.md` to optimize Arunaki's LLM pipeline friendliness:
1. Updated `ContextManager` threshold from `0.50` (64k tokens) to `0.25` (32k tokens) for aggressive early context pruning.
2. Reduced `injectionMaxChars` budget from `7000` to `2000` chars to prevent prompt inflation.
3. Reduced `toolPruneChars` from `2000` to `1000` and `toolPreviewChars` from `500` to `250` for lightweight tool output handling.
4. Refactored `ProviderService` to delegate provider preset and model rotation to `ProviderCatalogService`.

## Files Changed
- `apps/api/src/modules/ai/context-manager.ts` — Updated `DEFAULT_CONFIG` defaults.
- `apps/api/src/modules/ai/ai.service.ts` — Updated `ContextManager` instantiation.
- `apps/api/src/modules/provider/provider-catalog.service.ts` — Created `ProviderCatalogService` for clean preset detection.
- `apps/api/src/modules/provider/provider.service.ts` — Delegated rotation logic to catalog service.
- `apps/api/src/modules/provider/provider.module.ts` — Registered `ProviderCatalogService`.

## Tests
- `npx vitest run` — ✅ 56/56 passed
- `npx nest build` — ✅ 0 errors
