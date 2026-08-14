# Dev Log — Fix Kenari Provider Cooldown Decryption & Intra-Provider Multi-Model Pool Failover

**Date & Time:** 2026-08-14 18:45:00 WIB  
**Author:** Antigravity AI Software Engineer  

## What
Diagnosed and fixed the issue where requests failed by falling back to Groq instead of Kenari, and upgraded model rotation to support intra-provider multi-model pool failover:
1. **Root Cause 1 (Decryption Fallback Bug)**: In `ProviderService.decryptApiKey()`, when decryption failed for encrypted JSON strings, the catch block returned the raw ciphertext JSON string `{"cipherText":...}`. When sent to Kenari, Kenari returned `HTTP 401: invalid key`.
2. **Root Cause 2 (Masked Key Re-encryption)**: `ProviderController` masked API keys with `.substring(0, 8)...` without decrypting first (taking `{"cipher...`). When saving provider edits from UI, `updateProvider()` saw `apiKey` as non-empty and re-encrypted `"{\"cipher..."` into invalid double-encrypted payloads.
3. **Root Cause 3 (5-Minute Cooldown Lockout)**: `HTTP 401: invalid key` triggered a 300s (5-minute) cooldown on Kenari. During cooldown, `getActiveConfigRespectingCooldown()` deferred all requests to `.env Fallback` (Groq), which hit 429 rate limits and 413 context size limits.
4. **Intra-Provider Multi-Model Pool Failover Upgrade**: Previously, `getNextAvailable()` ignored secondary/fallback models selected in a provider's model pool (`deepseek-v4-flash, deepseek-v4-flash:free, gpt-oss-120b`) and jumped straight to other providers or Groq on error. Now, `getNextAvailable()` creates virtual model candidate IDs (`providerId::modelId`) so that model rotation checks all models selected in the active provider's pool sequentially before falling back elsewhere!

## Fixes Implemented
- `apps/api/src/modules/provider/provider.service.ts`:
  - `decryptApiKey()` now safely handles decryption errors by logging a warning and returning `''` instead of leaking raw JSON ciphertext strings.
  - `updateProvider()` checks `if (data.apiKey.includes('...')) delete data.apiKey;` so saving from UI preserves the actual stored DB key instead of overwriting with masked strings.
  - `updateProvider()` resets `cooldownUntil: null` so updating a provider clears any active cooldown lock.
  - `getNextAvailable()` upgraded to iterate through comma-separated model pools for enabled providers (`kenari::deepseek-v4-flash` -> `kenari::deepseek-v4-flash:free` -> `kenari::gpt-oss-120b`) before jumping to external fallbacks.
  - `recordUsage()`, `recordError()`, and `setCooldown()` updated to parse base provider ID from virtual model candidate IDs (`id.split('::')[0]`).
- `apps/api/src/modules/provider/provider.repository.ts`:
  - `setActive()` resets `cooldownUntil: null` so activating a provider removes any leftover cooldown.
- `apps/api/src/modules/provider/provider.controller.ts`:
  - `findAll()`, `findOne()`, `create()`, and `update()` now call `decryptApiKey()` to decrypt the key before producing the masked preview `${decrypted.substring(0, 8)}...`.
  - `update()` strips `body.apiKey` if it contains `...` before saving.
- `apps/api/src/modules/ai/ai.service.ts`:
  - `getProviderConfig()` now uses virtual model candidate ID (`id::primaryModel`) when multiple models exist in the provider pool.
- `apps/api/src/modules/ai/stream-chat.ts`:
  - `streamWithFallback()` updated to pass `triedProviders` set to `getNextAvailable()`.

## Files Changed
- `apps/api/src/modules/provider/provider.service.ts`
- `apps/api/src/modules/provider/provider.repository.ts`
- `apps/api/src/modules/provider/provider.controller.ts`
- `apps/api/src/modules/ai/ai.service.ts`
- `apps/api/src/modules/ai/stream-chat.ts`
- `apps/api/src/modules/provider/provider.service.spec.ts`

## Tests
- `npx tsc -p apps/api/tsconfig.build.json --noEmit` — ✅ Passed (0 errors)
- `npx vitest run apps/api/src/modules/provider/provider.service.spec.ts` — ✅ Passed (11/11 unit tests passed, including new intra-provider multi-model pool failover test)

## Notes
- Clearing `cooldownUntil` on provider activation/update ensures providers immediately recover when edited or re-selected in Settings.
- Selected models in the Settings Model Pool are now 100% active fallbacks that rotate sequentially within the same provider connection before any external fallback occurs!
