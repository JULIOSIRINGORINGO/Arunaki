# Dev Log — Fix Model Payload Mismatch During Provider Rotation

**Date & Time:** 2026-07-31 12:41 WIB
**Author:** Antigravity

## What
Resolved `HTTP 400: llama-3.3-70b-versatile is not a valid model ID` error during provider rotation from Groq to OpenRouter.

## Root Cause Analysis
1. In `AiService.chat()` and `AiService.chatStream()`, the HTTP `body` payload object was constructed once with `model: provider.model` (e.g. Groq's `llama-3.3-70b-versatile`) before passing it into `runWithModelFallback` or `streamWithFallback`.
2. When a provider rotation occurred (e.g. Groq -> OpenRouter), `makeRequest` used the initial `options.body` object which still contained Groq's model string `llama-3.3-70b-versatile`.
3. OpenRouter rejected Groq's model identifier string with `HTTP 400: llama-3.3-70b-versatile is not a valid model ID`.

## Fixes Implemented
1. **`model-fallback.ts` & `stream-chat.ts`:**
   - Overrode `requestBody.model = provider.model` dynamically inside the fallback loop before calling `makeRequest()`.
   - Guaranteed that whenever rotation switches providers (e.g. Groq -> OpenRouter -> Gemini), the HTTP request body payload automatically receives the target provider's model string.

## Verification
- Source code compilation clean (0 errors).
- Model payload dynamically matches each provider during rotation.
