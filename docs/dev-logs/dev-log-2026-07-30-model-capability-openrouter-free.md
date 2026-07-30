# Dev Log — Model Capability Registry + openrouter/free

**Date & Time:** 2026-07-30 10:24 WIB
**Author:** AI Agent

## What
Fixed provider rotation failure (400/404 errors) by adapting OpenClaw's capability-aware request pattern into Arunika.

Key changes:
1. **Model Capability Registry** (`model-capability.ts`) — tracks which models support tool calling. Unknown models default to `supportsTools: true` (safe default for modern models).
2. **Default model** changed from `nvidia/nemotron-3-ultra-550b-a55b:free` → `openrouter/free` — OpenRouter auto-selects compatible free model.
3. **Free model fallback pool** updated to use confirmed-existing free model IDs from OpenRouter catalog.
4. **Capability check** — before sending `tools` param in request body, check `modelSupportsTools(provider.model)`. Skip `tools` for models that don't support it, preventing 400 errors.
5. **Removed 4-phase compression** (`prepareMessages()`) — simplified to lightweight message trim (keep last 40 messages). Free/small models can't handle heavy per-round processing. Following OpenClaw's pattern: simple agent loop, no heavy compression/posture/evaluation per round.

## Files Changed
- `apps/api/src/modules/ai/model-capability.ts` — **NEW** model capability registry
- `apps/api/src/modules/ai/ai.service.ts` — capability check, default model → openrouter/free, removed prepareMessages(), lightweight trim
- `apps/api/src/modules/provider/provider.service.ts` — updated FREE_MODEL_CANDIDATES to confirmed-existing models

## Tests
- `npx nest build` ✅ — zero errors
- Server starts and health endpoint returns 200 ✅

## Notes
- Test suite (`vitest run`) has pre-existing config issue — `describe is not defined` in `app.controller.spec.ts` (related to vitest globals setup). Not caused by this change.
- Next step after this: build Settings UI for multi-provider/multi-key configuration.