# Dev Log — Fix Unknown Error & Cross-Provider Fallback Key Mismatch

**Date & Time:** 2026-07-31 12:36 WIB
**Author:** Antigravity

## What
Resolved `Error: All providers exhausted after 4 rotations. Last error: unknown` error during multi-provider rotation.

## Root Cause Analysis
1. **Uncaptured Error Messages:** In `model-fallback.ts` and `stream-chat.ts`, when an HTTP error status (401, 404, 429, 413) occurred, `lastError` was not being updated in the `options.classifyError()` path. When all rotations completed, it outputted `Last error: unknown`.
2. **Cross-Provider API Key Mismatch:** When `getNextAvailable()` rotated to OpenRouter fallback candidate pool models (`FREE_MODEL_CANDIDATES`), it used `process.env.AI_API_KEY`. Because `process.env.AI_API_KEY` was set to Groq's key (`gsk_...`), sending Groq's API key to `https://openrouter.ai/api/v1` resulted in HTTP 401 Unauthorized for all OpenRouter fallback candidates!

## Fixes Implemented
1. **`model-fallback.ts` & `stream-chat.ts`:**
   - Captured exact classified error messages into `lastError` variable on HTTP error status codes.
2. **`ProviderService` (`apps/api/src/modules/provider/provider.service.ts`):**
   - Updated `getNextAvailable()` to query the database for registered OpenRouter provider API keys when falling back to OpenRouter candidates, avoiding key mismatch errors.

## Verification
- Source code compilation clean (0 errors).
- Cross-provider rotation (Groq <-> OpenRouter) works seamlessly.
