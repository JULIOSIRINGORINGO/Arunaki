# Dev Log — Rename packages/engine/opencode → packages/engine/engine

**Date & Time:** 2026-09-02 WIB
**Author:** opencode (AI agent)

## What
Folder engine yang merupakan fork OpenCode di-rename dari `packages/engine/opencode`
menjadi `packages/engine/engine` supaya konsisten dengan struktur package lain di
`packages/engine/*` (`core`→`@arunaki/core`, `llm`→`@arunaki/llm`, `sdk`→`@arunaki/sdk`,
`server`→`@arunaki/server`, dst; nama folder = basename package tanpa scope). Isi
npm package tetap `@arunaki/engine` — tidak ada API/import yang berubah.

## Files Changed
- `packages/engine/opencode/` → `packages/engine/engine/` — full-file `git mv`
  (297 file rename, konten tidak diubah).
- `scripts/dev-app.cjs:84` — `path.join(rootDir, 'packages','engine','opencode',...)`
  → `...'engine','engine',...`; komentar "OpenCode engine" → "Arunaki engine".
- `WORKFLOW.md`, `docs/MASTER-HARNESS-PLAN.md`, `docs/ENGINE-FEATURE-TRIAGE.md`,
  `docs/DOCUMENT-MAP.md` — replace `packages/engine/opencode` → `packages/engine/engine`.
- `bun install` — regenerate junction `node_modules/@arunaki/engine` → `packages/engine/engine`
  (symlink workspace lama menyangkut ke path usang → modul `@arunaki/engine/tool`
  sempat tidak resolve).

## Tests
- `bunx tsgo --noEmit` (engine) — ✅ 0 error.
- `bun test test/server/httpapi-oauth.test.ts test/server/httpapi-providers.test.ts` — ✅ 6 pass.
- `node --check scripts/dev-app.cjs` — ✅.

## Notes
- Referensi path lama yang DIBIARKAN (sengaja): `docs/dev-logs/*` (provenance/history),
  `docs/superpowers/plans/*` (plan historis), dan satu baris WORKFLOW Phase 65→66 yang
  mendokumentasikan rename ini.
- Sisa string "opencode" yang tersisa di repo: `packages/engine/engine/bin/opencode` +
  `script/postinstall.mjs` + `Dockerfile` (mekanisme distribusi compiled-CLI/.exe, masih
  defer), `models.opencode.ai` di models-dev.ts (feed upstream), fixtures/recordings test
  (data provider "opencode", provenance), dan folder `.opencode/` (tooling agent).