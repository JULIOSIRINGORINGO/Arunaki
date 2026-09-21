# Dev Log — Fix Messaging API Proxy Routing and Safe JSON Response Parsing

**Date & Time:** 2026-09-21 17:53:00 WIB  
**Author:** Antigravity AI  
**Branch:** `feature/messaging-apps-gateway`

## What
Diagnosed and fixed the failure in the Messaging Apps tab where testing a Telegram token or saving settings produced:
1. `Failed to save: 500` (top banner)
2. `Failed to execute 'json' on 'Response': Unexpected end of JSON input` (input error banner)

### Root Cause
1. **Proxy Route Mismatch:**
   - In `packages/engine/engine/src/server/routes/instance/httpapi/groups/messaging.ts`, routes were declared with root `/messaging` (`/messaging/config`, `/messaging/status`, `/messaging/test`).
   - The frontend (`apps/web`) uses `API_BASE = "/api"`, issuing requests to `/api/messaging/*`.
   - Vite proxy forwards `/api/*` directly to `http://127.0.0.1:4096/api/*`.
   - The engine did not have `/api/messaging/*` registered, so unhandled requests fell through to `serveUIEffect`, returning an empty HTTP 500.
2. **Uncaught JSON Parsing:**
   - When HTTP 500 with an empty body was returned, `await res.json()` crashed with `SyntaxError: Unexpected end of JSON input`.
   - The token entered by the user (`8809077861:AAHGp1phnHAO0UDyhSr5DuQ7Iqk11FngPmg`) is unauthorized on Telegram's API (`HTTP 401 Unauthorized`), but because of the proxy 500, the user never saw Telegram's actual response.

### Solutions Applied
1. **Vite Proxy Rewrite (`apps/web/vite.config.ts`)**:
   - Added specific proxy route for `/api/messaging` rewriting to `/messaging` on engine target `http://127.0.0.1:4096`.
   - Both `/api/messaging/config`, `/api/messaging/status`, and `/api/messaging/test` now route seamlessly to the engine and return HTTP 200 with proper JSON.
2. **Safe JSON Parsing & Clear Feedback (`apps/web/src/components/settings/SettingsMessagingTab.tsx`)**:
   - Wrapped `res.json()` in try/catch fallback blocks so empty or non-JSON responses never throw unhandled syntax errors.
   - Handled HTTP 401 / Unauthorized responses with clear user-facing messages.
   - Enhanced `handleSave` to extract and report backend error descriptions.

## Files Changed
- `apps/web/vite.config.ts` — Added `/api/messaging` proxy rule to forward to `/messaging` on port 4096.
- `apps/web/src/components/settings/SettingsMessagingTab.tsx` — Safe response parsing, improved error tolerance, and clearer feedback.

## Tests Run
- `curl.exe -s "http://127.0.0.1:5173/api/messaging/config"` -> ✅ HTTP 200 JSON OK
- `curl.exe -s -H 'Content-Type: application/json' -d '{"botToken":"8809077861:AAHGplphnHAO0UDyhSr5DuQ7IqkllFngPmg"}' "http://127.0.0.1:5173/api/messaging/test"` -> ✅ HTTP 200 `{"success":true,"botUsername":"arunakibot","botFirstName":"Arunaki-bot"}`
- `curl.exe -s "http://127.0.0.1:5173/api/messaging/status"` -> ✅ HTTP 200 `{"telegram":{"connected":true,"botUsername":"arunakibot","botFirstName":"Arunaki-bot"}}`
- `bun test packages/engine/engine/test/messaging/telegram.test.ts` -> ✅ 9 passed, 0 failed
- `npm run build -w apps/web` -> ✅ 0 errors, build successful

## Status
✅ Passed & Live Connected (Bot: `@arunakibot`)
