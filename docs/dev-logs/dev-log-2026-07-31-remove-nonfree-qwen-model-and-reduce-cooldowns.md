# Dev Log — Remove Paid Qwen Model Slug & Optimize Cooldown Durations

**Date & Time:** 2026-07-31 12:45 WIB
**Author:** Antigravity

## What
Resolved `HTTP 404: This model is unavailable for free. The paid version is available now - use this slug instead: qwen/qwen-2.5-72b-instruct` error during OpenRouter rotation.

## Root Cause Analysis
1. OpenRouter transitioned `qwen/qwen-2.5-72b-instruct` from `:free` tier to paid tier, causing fallback calls to hit HTTP 404.
2. A 60-second cooldown on HTTP 400 errors locked the primary Groq LPU endpoint unnecessarily when minor request parameters failed.

## Fixes Implemented
1. **`ProviderService` (`apps/api/src/modules/provider/provider.service.ts`):**
   - Removed `qwen/qwen-2.5-72b-instruct:free` from `FREE_MODEL_CANDIDATES` pool.
   - Reduced HTTP 400 cooldown duration from 60s down to 5s.
   - Reduced HTTP 429 rate limit cooldown from 60s down to 20s.
2. **Database Cooldown Reset:**
   - Cleared all active cooldown timers in SQLite database (`dev.db`).

## Verification
- Direct API test call to Groq verified 200 OK with tool calling in 110 ms.
- Source code compilation clean (0 errors).
