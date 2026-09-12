# Dev Log — Remove DEFUNCT_MODELS Hardcode & Auto-Refresh Catalog

**Date & Time:** 2026-09-12 19:03:00 WIB
**Author:** Antigravity (Claude Opus 4.6)

## What
Removed hardcoded `DEFUNCT_MODELS` blocklist from 6 files across frontend and backend. Replaced with fire-and-forget auto-refresh that fetches live model lists from provider APIs on every app launch. Dead/discontinued models now automatically disappear without needing code changes or app updates.

## Files Changed
- `apps/web/src/App.tsx` — Replaced self-healing migration (hardcoded string matching) with `refreshModelCatalog()` async function that fetches provider list and model catalogs from API on launch
- `apps/web/src/components/settings/constants.ts` — Removed `DEFUNCT_MODELS` export
- `apps/web/src/components/settings/ModelProviderSettings.tsx` — Removed all `.filter((m) => !DEFUNCT_MODELS.has(m))` calls (7 occurrences)
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Removed `DEFUNCT_MODELS` import and filter in `resolveActiveSingleModel()`
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/provider.ts` — Removed `DEFUNCT_MODELS` Set and filters in `providerUIItem()` and `upsert()`
- `packages/engine/core/src/session/runner/model.ts` — Removed `DEFUNCT_MODELS` Set, `isHealthy` filter, and `healthyAvailable` variable; replaced with direct `allAvailable` usage

## Tests
- `npm run build -w apps/web` — ✅ passed (tsc 0 errors, vite 2246 modules transformed, built in 28.26s)

## Notes
- Auto-refresh is fire-and-forget (non-blocking) — app doesn't wait for it to complete before rendering
- If API is unreachable (offline), cached localStorage values are preserved (graceful degradation)
- After refresh, active model is validated against updated catalog; if no longer available, auto-fallback to first model in pool
