# Dev Log — Fix Model Pool Comma-Separated String Timeout & E2E Browser Verification

**Date & Time:** 2026-09-07 12:11:00 WIB  
**Author:** AI Software Engineer  

## What
Diagnosed and resolved upstream timeout (`Upstream Provider Timeout: No response received from Kenari within 90 seconds`) and successfully verified the complete E2E chat interaction directly inside the web browser.

### Root Cause
1. In `ModelProviderSettings`, enabled models for a provider were saved in `localStorage` under `arunaki_provider_models_${providerId}` as a comma-delimited string representing the routing pool (e.g. `"mistral-large:free, muse-spark-1-2-contributor:free, hy3:free, ..."`).
2. `useWorkstationChat.ts` read that key directly and passed the entire 20-model string as `model.id` to `createSession` and `switchSessionModel`.
3. The upstream provider (Kenari) received the entire comma-delimited string as the model name, which does not exist, causing requests to stall until the 90-second watchdog timed out.
4. Furthermore, probe testing revealed that `mistral-large:free` on Kenari returns `400: model not found`, while `glm-4-7-flash:free` (847ms) and `mistral-medium-3-5:free` (617ms) respond reliably and instantly.

### Solution
1. **Single Model Resolution (`resolveActiveSingleModel`)**:
   - Added helper in `useWorkstationChat.ts` to parse the routing pool string and extract a single valid model identifier, filtering out defunct models.
   - Updated `DEFAULT_MODELS.kenari` in `constants.ts` with verified high-speed models (`glm-4-7-flash:free`, `mistral-medium-3-5:free`, etc.).
2. **Engine & API Sanitization (`apps/web/src/lib/engine.ts` & `packages/engine/core/src/session/runner/model.ts`)**:
   - Sanitized model payloads in `createSession` and `switchSessionModel` so comma-separated strings are split and resolved to a single model.
   - In `SessionRunnerModel.resolve`, added fallback logic so if a session references an unavailable model or a raw pool string, it automatically selects an available supported model with an active API key for that provider.

## Tests & Verification
- **E2E Web Browser Test via `browser_subagent`**:
  - Navigated to `http://127.0.0.1:5173`.
  - Created a new chat session via `+` button.
  - Sent prompt `"halo"`.
  - Verified Assistant response received within ~2s with thinking trace (`Thought for 1s`) and full greeting response:
    > "Hello! 👋 I'm your Document AI agent, ready to help you process and work with documents..."
  - Verified NO `401: missing_api_key` and NO `Upstream Provider Timeout`.
  - Browser recording saved to `web_chat_test_1788757759592.webp`.
- **Build Verification**: `npm run build -w apps/web` passed with 0 errors.

## Notes
The model routing and session resolution are now robust against routing pool strings and defunct model IDs.
