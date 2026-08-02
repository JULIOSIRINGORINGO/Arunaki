# Dev Log — Layer 4 & 5 Security Fixes

**Date & Time:** 2026-08-02 18:05:00 WIB
**Author:** Antigravity (AI)

## What
Fixing security gaps from the Audit Report (Layer 4 & 5) specifically findings 4.1, 4.2, and 5.4.
- Connected the `SecretsVaultService` to `ProviderService` so API keys are now securely encrypted in SQLite database.
- Implemented a Global `AuthGuard` in the API to prevent unauthorized access.
- Implemented `token` validation on the WebSocket Bridge in `DesktopBridgeService` and added the token via `process.env.ARUNAKI_API_KEY` on the Electron client.

## Files Changed
- `apps/api/src/modules/provider/provider.service.ts` — Added `SecretsVaultService` for encrypt/decrypt.
- `apps/api/src/modules/provider/provider.module.ts` — Injected `SecretsVaultService`.
- `apps/api/src/modules/provider/provider.service.spec.ts` — Fixed failing test due to missing env var `APP_SECRET`.
- `apps/api/src/modules/security/auth.guard.ts` — Created global API Guard.
- `apps/api/src/main.ts` — Attached `AuthGuard` globally.
- `apps/api/src/modules/interaction/desktop-bridge.service.ts` — Added token query param check for websocket connection.
- `apps/desktop/main.cjs` — Append `?token=XYZ` to backend websocket connection URL.
- `LAPORAN_AUDIT_ARUNAKI.md` — Checked off findings 4.1, 4.2, and 5.4.

## Tests
- `npm run test` — ✅ passed (56/56 passed)

## Notes
- `ARUNAKI_API_KEY` must be set for external API access, or else the app falls back to `Unauthorized` when attempting access from outside. For development convenience, it skips blocking if no key is set, but warns in the terminal.
- `APP_SECRET` must be set in production, otherwise `SecretsVaultService` will throw errors.
