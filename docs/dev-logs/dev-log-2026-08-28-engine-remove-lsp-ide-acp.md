# Dev Log — Engine REMOVE: LSP / IDE / ACP / CLI GitHub

**Date & Time:** 2026-08-28 08:00 WIB
**Author:** AI Agent

## What
Eksekusi item 🗑️ REMOVE konsolidasi engine `packages/engine/opencode/` — fitur IDE
(LSP service + tool, `ide/`, `acp/` + CLI, `attach`/`github`/`pr`) dihapus.
Wajib: tidak muncul error TS file baru terhadap baseline tsgo 775 (semua
pre-existing lapisan TUI `@opentui`/`@Arunaki-ai/tui`).

## Files Changed
- `src/tool/lsp.ts`, `src/lsp/*` (client/diagnostic/language/launch/lsp/server),
  `src/ide/index.ts`, `src/acp/*`, `src/cli/cmd/{acp,attach,github,github.handler,github.shared,pr,debug/lsp}.ts` — **deleted**
- `src/tool/registry.ts` — hapus `lsp: Tool.init`, `LSP.node`, `flags.experimentalLspTool`
- `src/cli/cmd/run/tool.ts` — hapus definisi/rule lsp; **restore `toolFiletype` + ext→language map inline** (2 pemakai: footer.permission.tsx, scrollback.writer.tsx)
- `src/cli/cmd/agent.ts` — hapus `"lsp"` dari AVAILABLE_PERMISSIONS
- `src/effect/runtime-flags.ts` — hapus `disableLspDownload`, `experimentalLspTy`, `experimentalLspTool` (pertahankan `autoShare`)
- `src/server/routes/instance/httpapi/` — hapus endpoint `lsp`/`findSymbol` (groups/file, groups/instance, handlers/file, handlers/instance, server.ts)
- `src/effect/app-runtime.ts`, `bootstrap-runtime.ts`, `project/bootstrap.ts`, `server.ts` — **revert pencabutan prematur** Workspace/Worktree/ShareNext/SessionShare (tetap utuh; hanya LSP yang hilang)
- `src/tool/{read,apply_patch,edit,write}.ts` — import rusak di-revert (FSUtil/Schema/Semaphore); `read.ts` buang `warm()` peninggalan
- Test: hapus `test/{acp,lsp,ide}/`, `test/cli/acp/`, `test/cli/github-*.test.ts`, `test/tool/lsp.test.ts`; strip LSP dari `test/session/{prompt,snapshot-tool-race}.test.ts`, `test/tool/{write,edit,read,apply_patch}.test.ts`, `test/tool/parameters.test.ts`; update `test/effect/runtime-flags.test.ts`, `test/server/httpapi-file.test.ts`
- `docs/ENGINE-FEATURE-TRIAGE.md`, `WORKFLOW.md` (Phase 62.5) — update status

## Tests
- `tsgo --noEmit` (baseline via git stash / now): **775 → 745 error**, 0 file error baru
- `bun test test/tool/{write,edit,read,apply_patch,parameters}.test.ts test/effect/runtime-flags.test.ts test/server/httpapi-file.test.ts` — ✅ passed (3 fail `httpapi-file` timeout + `read` Windows path **terbukti pre-existing** via baseline run)
- `bun test test/session/{prompt,snapshot-tool-race}.test.ts` — ✅ pola pass/fail identik baseline (11 pass; kegagalan environment setempat)

## Notes
- Regresi saat proses: `toolFiletype` sempat ikut terhapus padahal dipakai 2 file TUI (`footer.permission.tsx`, `scrollback.writer.tsx`) — di-restore inline bersama map bahasa.
- `test/session/llm-native-recorded.test.ts` error `@Arunaki-ai/http-recorder` = pre-existing (bukan LSP).
- Pencabutan Workspace/Worktree/ShareNext/SessionShare prematur memunculkan error `import.ts`/`worktree.ts`/`server.ts` — di-revert; jangan sentuh modul itu sebelum todo worktree/share/control-plane dieksekusi.
- Lanjutan: `worktree` → `share` → `control-plane` (ganti `WorkspaceContext`), lalu `sync`, `tui`; kebersihan `git status` sebelum push.