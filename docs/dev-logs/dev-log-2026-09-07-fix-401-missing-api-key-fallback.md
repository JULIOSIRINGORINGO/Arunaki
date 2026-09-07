# Dev Log — Fix 401 Missing API Key Engine Fallback

**Date & Time:** 2026-09-07 11:45:00 WIB  
**Author:** AI Software Engineer  

## What
Resolved upstream `HTTP 401: {"error":{"message":"Invalid Authentication","type":"invalid_request_error","code":"missing_api_key","status":401}}` when sending chat messages.

### Root Cause
When user started a new chat session without explicitly passing `model`, the Engine's `SessionRunnerModel.resolve` fell back to `(yield* catalog.model.available()).find(supported)`. Because ModelsDev populates public models where providers without integration IDs were deemed available, unauthenticated external providers (such as `nano-gpt/TheDrummer/Artemis-v1.1`) appeared before Kenari in the list. When dispatched, `nano-gpt` failed authentication because no API key was configured for it.

### Solution
1. **Engine Model Fallback Prioritization (`packages/engine/core/src/session/runner/model.ts`)**:
   - Filtered available models to prioritize models that have an active API key configured or belong to `kenari` before falling back to arbitrary unauthenticated catalog items.
2. **Explicit Session Model Creation & Binding (`apps/web/src/lib/engine.ts` & `apps/web/src/components/workstation/chat/useWorkstationChat.ts`)**:
   - Extended `createSession` to accept `{ providerID: string, id: string }` and pass it to the engine `POST /api/session`.
   - Added `switchSessionModel` API helper.
   - Updated `useWorkstationChat` to retrieve the active provider and model from `localStorage` (`kenari` / `mimo-v2-5:free`) and bind the session upon creation and prompt submission.

## Files Changed
- `packages/engine/core/src/session/runner/model.ts` — Prioritize authenticated providers (`withKey`) in fallback resolver.
- `apps/web/src/lib/engine.ts` — Added `model` payload in `createSession` and added `switchSessionModel`.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Bind session to active local provider/model.

## Tests
- E2E Session Streaming Test (`scratch/test-e2e-chat.mjs`): ✅ Passed — Kenari received prompt, streamed reasoning and text tokens, completed with `finish: "stop"`.
- Web App Build (`npm run build -w apps/web`): ✅ Passed — 0 errors, TypeScript passed, production build generated.

## Notes
Sessions are now resilient against unauthenticated third-party provider hijacking.
