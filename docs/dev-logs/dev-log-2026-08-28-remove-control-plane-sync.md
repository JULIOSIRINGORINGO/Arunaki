# Dev Log — Remove Control-Plane + Sync HTTP APIs

**Date & Time:** 2026-08-28
**Author:** AI Agent (opencode)

## What
Eksekusi item 🗑️ REMOVE engine `control-plane` + `sync` dari `packages/engine/opencode/` (lanjutan Phase 62.5 LSP/IDE dan 62.6 worktree/share dari triage `docs/ENGINE-FEATURE-TRIAGE.md`). Seluruh artefak control-plane dihapus, route workspace/control-plane/sync dilepas dari HTTP tree, SDK dikodegen ulang sehingga berhenti mengiklankan endpoint mati. Konsep agen-per-folder (`Session.location.directory`) menjadi satu-satunya model routing.

## Files Changed

### Deleted (source)
- `packages/engine/opencode/src/control-plane/` (adapters/index.ts, workspace.ts, types.ts, util.ts, workspace-adapter-runtime.ts, dev/README.md, dev/debug-workspace-plugin.ts)
- `packages/engine/opencode/src/server/routes/instance/httpapi/groups/{workspace,control-plane,sync}.ts`
- `packages/engine/opencode/src/server/routes/instance/httpapi/handlers/{workspace,control-plane,sync}.ts`
- `packages/engine/plugin/src/example-workspace.ts`

### Deleted (tests)
- `test/control-plane/{adapters.test.ts, workspace.test.ts}`
- `test/plugin/workspace-adapter.test.ts`
- `test/server/httpapi-{workspace,control-plane,sync,workspace-routing}.test.ts`

### Modified (engine)
- `src/server/routes/instance/httpapi/api.ts` — lepas `SyncApi`/`WorkspaceApi`/`ControlPlaneApi` dari `RootHttpApi` + `addHttpApi`
- `src/server/routes/instance/httpapi/middleware/workspace-routing.ts` — type return dibersihkan dari kebocoran `WorkspaceRouteContext`
- `src/server/routes/instance/httpapi/server.ts` — lepas 3 handler group + import `Workspace`/`MoveSession`/`Socket`; `workspaceRoutingLive`→`workspaceRoutingLayer`
- `src/server/shared/{fence.ts, workspace-routing.ts}` — hapus sync-gate `wait()` + proxy helpers
- `src/effect/app-runtime.ts` — hapus `Workspace.node`
- `src/plugin/index.ts` + `packages/engine/plugin/src/index.ts` — hapus surface `WorkspaceAdapter`/`experimental_workspace`

### Modified (tests)
- `test/fixture/workspace.ts`, `test/server/httpapi-instance-context.test.ts`, `test/server/httpapi-promptasync-context.test.ts`, `test/server/httpapi-session.test.ts`, `test/server/httpapi-exercise/index.ts`, `test/server/httpapi-schema-error-body.test.ts`, `test/server/httpapi-global.test.ts`, `test/server/httpapi-query-schema-drift.test.ts`, `test/server/sdk-error-shape.test.ts`, `test/server/workspace-routing.test.ts`, `test/server/httpapi-sdk.test.ts` (hapus `sdk.lsp.status()`, efek SDK) + 3 test plugin (cloudflare/codex/github-copilot-models, strip `experimental_workspace`)

### SDK (regenerated)
- `packages/engine/sdk/openapi.json` + seluruh `src/{gen, v2/gen}/*` + `src/v2/server.ts`/`data.ts`/`client.ts` — dikodegen ulang (route workspace/sync/control-plane hilang)
- `packages/engine/sdk/script/build.ts` — perbaiki path basi `../../Arunaki` → `path.resolve(dir, "..", "..", "engine", "opencode")`

### Docs
- `WORKFLOW.md` — tambah Phase 62.7 (DONE), update baris "Eksekusi REMOVE berikutnya"

## Tests
- Route coverage `script/httpapi-exercise.ts --mode coverage --fail-on-missing` — **187 pass / 0 fail / 0 missing / 0 extra** ✅ (199 − 12 scenario = 187)
- Focused suites (instance-context, promptasync-context, session, schema-error-body, workspace-routing, global, query-schema-drift, sdk-error-shape, 3 plugin, httpapi-sdk, plugin-loader) — failure set **identik baseline HEAD** (flaky timeout git/tmpdir/spawn, tanpa regresi) ✅
- `tsgo --noEmit` (opencode) — **745 error, 0 diff vs HEAD baseline** ✅ (hilang 2 error LSP latent setelah fix konsumen)
- SDK `bun run typecheck` (tsgo) — clean ✅; SDK `bun test` — 1/1 ✅

## Notes
- Tabel `Workspace` di SQLite (**core**) dipertahankan sebagai kolom DB inert; hanya lapisan HTTP/service engine yang dihapus.
- Test instance-context memakai query param `directory` sebagai ganti header karena harness effect menulis header key dalam lowercase sehingga header `x-Arunaki-directory` tidak cocok dengan lookup mixed-case middleware pada POST — quirk harness pre-existing; jalur produksi utama memang lewat query param.
- PCMTIM test `provides instance context from the routed directory` + beberapa kasus lain timeout saat suite berlari bersama (spawn `git commit` gagal sebagai PlatformError di Windows) — terverifikasi pre-existing di HEAD dengan nama sama.
- SDK regen ikut membuang route `/lsp` yang sudah dihapus server-side di Phase 62.5 tapi masih diiklankan SDK stale; 2 konsumen disesuaikan (`plugin/src/tui.ts`, `test/server/httpapi-sdk.test.ts`).