# Dev Log — Settings Menu 2/3: Account & License OAuth (Google + GitHub)

**Date & Time:** 2026-09-02 WIB
**Author:** opencode (AI agent)

## What
Tombol "Continue with Google"/"Continue with GitHub" di Settings → Account &
License yang tadinya hanya `toast` "will be available in the upcoming release"
sekarang menjalankan OAuth authorization-code flow sungguhan (popup →
provider → callback → profil → localStorage). Email/password lama dibiarkan
(localStorage kosmetik). Licensing/cloud-sync tetap placeholder haram —
engine tidak punya konsep license (terverifikasi audit, tidak dibuat).

## Files Changed
- `packages/engine/opencode/src/server/routes/instance/httpapi/groups/oauth.ts` — BARU:
  `OAuthApi` group, 3 endpoint (`start`/`callback`/`result`), schemas
  `OAuthProvider`, `OAuthStartResult`, `OAuthResult`, error class `OAuthApiError` (400).
- `packages/engine/opencode/src/server/routes/instance/httpapi/handlers/oauth.ts` — BARU:
  `oauthHandlers`. `start` validasi kredensial env + `state` uuid (TTL 10 mnt).
  `callback` raw HTML (branded `OauthCallbackPage` dari core) — exchange token &
  fetch profil Google/GitHub via `HttpClient`; error branch sebelum validasi state.
  `result` poll profil. Tanpa middleware Authorization (popup redirect tanpa api-key).
- `packages/engine/opencode/src/server/routes/instance/httpapi/api.ts` — `addHttpApi(OAuthApi)`.
- `packages/engine/opencode/src/server/routes/instance/httpapi/server.ts` — daftar `oauthHandlers`.
- `packages/engine/opencode/test/server/httpapi-oauth.test.ts` — BARU 3 test offline.
- `apps/web/src/pages/SettingsPage.tsx` — `handleOAuthLogin(provider)` +
  `pollOAuthResult`, tombol Google/GitHub wired, profil disimpan ke
  `arunaki_user_email/_name/_avatar`.
- `WORKFLOW.md` — Phase 63 checklist.

## Env (dibaca engine saat request)
`ARUNAKI_GOOGLE_CLIENT_ID`, `ARUNAKI_GOOGLE_CLIENT_SECRET`,
`ARUNAKI_GITHUB_CLIENT_ID`, `ARUNAKI_GITHUB_CLIENT_SECRET`,
`ARUNAKI_OAUTH_REDIRECT_BASE` (default `http://127.0.0.1:4096`).
Redirect URI yang wajib didaftarkan di masing-masing OAuth app:
`{REDIRECT_BASE}/api/oauth/google/callback` dan `.../api/oauth/github/callback`.

## Tests
- `bun test test/server/httpapi-oauth.test.ts` — ✅ 3/3 (unconfigured 400;
  start URL + pending result; callback invalid/denied/no-code → branded error HTML).
- `bun test test/server/httpapi-oauth.test.ts test/server/httpapi-providers.test.ts test/server/httpapi-config.test.ts test/config/config.test.ts` — ✅ 102 pass / 2 fail
  (keduanya proven pre-existing: MSYS2 path timeout + account env token).
- `bunx tsgo --noEmit` (engine) — ✅ 0 error.
- `npm run build -w apps/web` — ✅ built.

## Notes
- Flow login END-TO-END (callback nyata exchange + profil) belum diuji otomatis
  karena butuh kredensial OAuth asli + redirect URI; diuji offline untuk error
  paths + URL generation, dan manual dengan kredensial riil menyusul.
- State CSRF store = in-memory module map (`ponytail:` note di file) — pindah ke
  DB/state terdistribusi hanya jika engine diklaster.
- Menunggu: menu 3/3 Desktop Automation & Behavior (preferensi bisa ke engine
  global config via `/api/global/config`).