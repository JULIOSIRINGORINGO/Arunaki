# Dev Log — Rebrand Sisa: OpenAPI Spec, LLM Prompts, Provider, Skill Docs

**Date & Time:** 2026-08-28 WIB
**Author:** AI Agent

## What

Menuntaskan rebranding 1-to-1 sehingga tidak ada identitas "opencode" yang bocor di runtime/identitas Arunaki (Phase 60.1 hanya rebrand package names). Audit menyeluruh `git grep -i opencode` lalu bersihkan file identitas: system prompts LLM, template tool/command, rename provider file, skill docs disamakan dengan fakta config loader, sdk openapi.json di-regen dari source yang sudah bersih.

## Files Changed

- `packages/engine/sdk/openapi.json` — di-regen via `bun dev generate` (dari stale 601× "opencode" → 0; title "arunaki", desc "Arunaki api", 188 ops).
- `packages/engine/opencode/src/session/prompt/{default,beast,codex,copilot-gpt-5,gemini,gpt,kimi,meta,trinity,anthropic}.txt` — "opencode"/"OpenCode" → "Arunaki"; repo URL → `JULIOSIRINGORINGO/Arunaki`; docs → `arunaki.ai`.
- `packages/engine/opencode/src/tool/lsp.txt`, `packages/engine/opencode/src/command/template/initialize.txt`, `packages/engine/core/src/plugin/command/initialize.txt` — rebrand; `opencode.json` → `arunaki.json`.
- `packages/engine/core/src/plugin/provider/opencode.ts` → `arunaki.ts` (rename, isi sudah Arunaki); import di `plugin/provider.ts:24`; test `provider-opencode.test.ts` → `provider-arunaki.test.ts` (+ fix case import).
- `packages/engine/core/src/plugin/skill/customize-arunaki.md` — disamakan dengan loader nyata: `.Arunaki/` (kapital, `config/paths.ts:29,35`), `~/.config/arunaki/` (`core/global.ts:13`), `@arunaki/plugin`, `arunaki.ai/config.json`.
- `packages/engine/core/src/plugin/skill/customize-opencode.md` — dihapus (duplikat tak terpakai).
- `packages/engine/core/src/effect/dfdf` — dihapus (scratch file).
- `WORKFLOW.md` — Phase 61.6 Rebrand Sisa (DONE).

## Tests

- `npm run build -w apps/web` — ✅ 0 error (2200 modules)
- `bun run typecheck` (engine/core) — ✅ bersih untuk perubahan; sisa error pre-existing `@Arunaki-ai/http-recorder` (tidak terkait)
- `bun test test/plugin/provider-arunaki.test.ts` — ✅ 12 pass / 0 fail

## Notes

- **Dipertahankan (flag):** `models-dev.ts:160-163` `https://models.opencode.ai` (data feed live, tidak boleh diubah — perlu domain Arrnaki live dulu); mekanisme distribusi `opencode/bin/opencode` + `postinstall.mjs` + `Dockerfile` + `core/package.json` `bin` → `./bin/opencode` (file belum ada; sengaja dibiarkan menunggu keputusan MASTER PROMPT single-harness .exe). Sisa referensi lain (docs/specs/fixtures/test recordings/vendor auth) murni provenance.
- Pemetaan single-harness (MASTER PROMPT): engine sudah **embedded** — web → HTTP API :4096 → engine fork `packages/engine/opencode`; tidak ada mesin kedua. Yang tersisa hanyalah penamaan (sudah dibersihkan) + mekanisme distribusi bin/Dockerfile untuk fase .exe.