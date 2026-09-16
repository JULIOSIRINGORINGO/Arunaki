# Dev Log — Fix Test Ping Active Model Routing & Provider Selection

**Date & Time:** 2026-09-16 19:25:00 WIB  
**Author:** Antigravity AI

## What
Investigated and resolved user query regarding why calls went to `mimo-v2-5:free` instead of `agnes-2-5-flash:free`:
1. **Diagnosis**:
   - The user's document chat sessions (18:49–18:52 WIB) ran properly on `agnes-2-5-flash:free` consuming ~136k tokens per turn.
   - The calls appearing at 19:15–19:16 WIB to `mimo-v2-5:free` were 260-token requests (`prompt: "Hello, connection test."`, `max_tokens: 8`) triggered by clicking the **"Test Ping"** button in Settings.
   - The backend `testProvider` handler was hardcoded to take `Object.keys(info.models)[0]`, which mapped to `mimo-v2-5:free` because `mimo` was the first key in `arunaki.json` models dictionary, ignoring the user's primary selected model in the UI.
2. **Fix Implemented**:
   - Added `ProviderPingQuery` to `packages/engine/engine/src/server/routes/instance/httpapi/groups/provider.ts` accepting an optional `?model=` query param.
   - Updated `testProvider` in `packages/engine/engine/src/server/routes/instance/httpapi/handlers/provider.ts` to prioritize `ctx.query.model`, followed by `config.model` (the user's primary active model), falling back to dictionary keys only if neither is present.
   - Updated `ModelProviderSettings.tsx` to send the provider's active primary model (e.g. `agnes-2-5-flash:free`) in `handleTestConnection`.
   - Updated local `arunaki.json` to place `agnes-2-5-flash:free` as the primary default model and top key.

## Files Changed
- `apps/web/src/components/settings/ModelProviderSettings.tsx` — Pass provider's primary active model as `&model=` query param in live ping test.
- `packages/engine/engine/src/server/routes/instance/httpapi/groups/provider.ts` — Defined `ProviderPingQuery` with `model: Schema.optional(Schema.String)`.
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/provider.ts` — Updated `testProvider` to resolve model from query, `config.model`, or first model in pool.
- `arunaki.json` — Prioritized `agnes-2-5-flash:free` as default and top model in free pool.

## Tests
- `npm run typecheck` — ✅ Passed (0 TypeScript errors)
- `npm run build -w apps/web` — ✅ Passed (Vite build successful in 12.11s)

## Notes
- User settings were never corrupted; chat sessions continued using `agnes-2-5-flash:free`. Live ping now reliably tests the user's primary model.
