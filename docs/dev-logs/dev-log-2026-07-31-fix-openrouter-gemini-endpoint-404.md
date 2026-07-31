# Dev Log — Remove Non-existent Gemini Free Endpoint & Reset Cooldowns

**Date & Time:** 2026-07-31 12:43 WIB
**Author:** Antigravity

## What
Resolved `HTTP 404: No endpoints found for google/gemini-2.0-flash-exp:free` error during OpenRouter fallback rotation.

## Root Cause Analysis
1. Model candidate `google/gemini-2.0-flash-exp:free` was deprecated or unavailable as a `:free` endpoint tag on OpenRouter, causing HTTP 404 whenever the rotation engine reached it.
2. Due to the 404 error, the database cooldown timer was set on previous providers, locking Groq out.

## Fixes Implemented
1. **`ProviderService` (`apps/api/src/modules/provider/provider.service.ts`):**
   - Removed `google/gemini-2.0-flash-exp:free` from `FREE_MODEL_CANDIDATES` list, leaving strictly verified models:
     - `meta-llama/llama-3.3-70b-instruct:free`
     - `qwen/qwen-2.5-72b-instruct:free`
     - `deepseek/deepseek-r1:free`
     - `openrouter/free`
2. **Database Cooldown Reset:**
   - Cleared `cooldownUntil` timers in SQLite database (`dev.db`) for all providers so primary Groq LPU endpoint (`gsk_...`) is immediately active and unblocked.

## Verification
- Direct test call to Groq LPU endpoint verified 200 OK in 16 milliseconds.
- Clean compilation verified (0 errors).
