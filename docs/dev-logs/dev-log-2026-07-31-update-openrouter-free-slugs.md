# Dev Log — Update OpenRouter Unified Free Model Slugs

**Date & Time:** 2026-07-31 12:47 WIB
**Author:** Antigravity

## What
Resolved `HTTP 404: This model is unavailable for free ... use this slug instead: deepseek/deepseek-r1` error by switching all OpenRouter free model references to OpenRouter's official unified free model router `openrouter/free`.

## Root Cause Analysis
1. OpenRouter recently deprecated individual model `:free` suffixes (such as `deepseek/deepseek-r1:free`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen-2.5-72b-instruct:free`), returning HTTP 404 whenever they were called.
2. OpenRouter now mandates using `openrouter/free` (or `openrouter/auto`) for free tier model routing.

## Fixes Implemented
1. **`ProviderService` (`apps/api/src/modules/provider/provider.service.ts`):**
   - Updated `FREE_MODEL_CANDIDATES` fallback pool to strictly use `openrouter/free` and `openrouter/auto`.
2. **Database Update:**
   - Updated SQLite database (`dev.db`) OpenRouter model entries to `openrouter/free` and cleared all cooldown timers.

## Verification
- Verified `openrouter/free` direct API test call returned HTTP 200 OK.
- Verified Groq direct API test call returned 200 OK with tool execution in 110 ms.
- Source code compilation clean (0 errors).
