# Dev Log — Settings Menu 1/3: Model Routing & Providers wired to engine

**Date & Time:** 2026-09-02 WIB
**Author:** opencode (AI agent)

## What
Menu Settings → "Model Routing & Providers" (`apps/web`) yang sebelumnya
memanggil `/api/providers` dan menerima 404 (lalu terjebak fake/localStorage)
kini benar-benar terhubung ke engine `packages/engine/opencode`

(`httpapi` instance server) via door `/api/providers*`.

## Files Changed
- `packages/engine/opencode/src/server/routes/instance/httpapi/groups/provider.ts`
  — tambah HttpApiGroup `providers` (8 endpoint) + schemas
  (`ProviderUI`, `ProviderUpsert`, `ProviderStateInput`, `ProviderTestInput`,
  `ProviderFetchModelsInput`, result schemas).
- `packages/engine/opencode/src/server/routes/instance/httpapi/handlers/provider.ts`
  — `providerSettingsHandlers`: upsert/create/update/list/setState/remove/
  testConnection/testProvider/fetchModels (openai-compatible, `@ai-sdk/openai-compatible`).
- `packages/engine/opencode/src/server/routes/instance/httpapi/server.ts`
  — daftarkan `providerSettingsHandlers`.
- `packages/engine/opencode/src/config/config.ts` — `Config.Service.deleteProvider`
  baru; **fix `update()` + `deleteProvider()` target file: `config.json` → `arunaki.json`**
  (sebelumnya write tak pernah dibaca ulang oleh instance — akar masalah).
- `packages/engine/opencode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts`
  — lookup header `x-Arunaki-directory` → `x-arunaki-directory` (key header
  di-lowercase oleh harness effect).
- `packages/engine/opencode/test/server/httpapi-providers.test.ts` — BARU, 3 test live.
- `packages/engine/opencode/test/config/config.test.ts` + `test/server/httpapi-config.test.ts`
  — asersi file `config.json` → `arunaki.json` (mengikuti fix write-target).
- `packages/engine/opencode/test/fixture/config.ts` — mock `deleteProvider`.
- `apps/web/src/lib/api.ts` — helper `directoryQuery()`.
- `apps/web/src/pages/SettingsPage.tsx` — fetchProviders pakai `?directory=`.
- `apps/web/src/components/settings/ModelProviderSettings.tsx` — semua call
  `/api/providers*` pakai `?directory=`; toggle & priority → `PUT /providers/:id/state`.
- `WORKFLOW.md` — Phase 62.9 checklist.

## Tests
- `bun test test/server/httpapi-providers.test.ts` — ✅ 3/3 pass.
- `bun test test/server/httpapi-config.test.ts test/config/config.test.ts` — ✅ 96 pass / 2 fail
  (`MSYS2 path` timeout + `account env token` toBe) — keduanya **terbukti pre-existing**
  via `git stash` (fail juga tanpa perubahan ini).
- `bunx tsgo --noEmit` (engine) — ✅ 0 error.
- `npm run build -w apps/web` — ✅ built.

## Notes
- Semantik yang dijaga UI: `active` = tidak ada di `disabled_providers`,
  `priority` disimpan di `provider.options.priority` (list diurutkan naik).
  Model tersimpan sebagai `{ id, name }`. providerID = slug `form.type`.
- Test pakai timeout 30s karena multi-cycle instance disposal melebihi default
  bun 5s (bukan flake logic).
- Menunggu: menu 2/3 (Account & License) & 3/3 (Desktop Automation) lintasannya
  masih localStorage-only; lakukan 1-menu-per-commit berikutnya.