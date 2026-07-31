# Dev Log — Fix OpenRouter Nvidia Rate Limit & Update Fallback Pool

**Date & Time:** 2026-07-31 12:17 WIB
**Author:** Antigravity

## What
Resolved `ResourceExhausted: Worker local total request limit reached (32/32)` rate limit error from OpenRouter Nvidia free tier worker endpoint.

## Root Cause Analysis
1. `.env` configured `AI_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free`.
2. OpenRouter's Nvidia free tier endpoints hit a strict 32/32 worker quota limit under burst requests, returning HTTP 400/429 errors.
3. Fallback candidates list in `ProviderService` had obsolete model identifiers.

## Fixes Implemented
1. **`apps/api/.env`:**
   - Switched default model to `meta-llama/llama-3.3-70b-instruct:free` (high capacity, tool-calling supported, no 32/32 worker limit).
2. **`apps/api/src/modules/provider/provider.service.ts`:**
   - Updated `FREE_MODEL_CANDIDATES` fallback pool to active models:
     - `meta-llama/llama-3.3-70b-instruct:free`
     - `google/gemini-2.0-flash-exp:free`
     - `qwen/qwen-2.5-72b-instruct:free`
     - `deepseek/deepseek-r1:free`
     - `openrouter/free`

## Verification
- Clean compilation verified (0 errors).
- Requests no longer fail with Nvidia rate limit.
