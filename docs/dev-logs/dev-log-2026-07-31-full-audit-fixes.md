# Dev Log — Full Code Audit & Bug Fixes

**Date & Time:** 2026-07-31 11:50 WIB
**Author:** opencode (deepseek-v4-flash-free)

## What
Full-code audit (2 parallel sub-agents: API logic + web/desktop) menemukan 17 bug logika nyata + 2 celah keamanan. Semua difix dan terverifikasi. Approval gate untuk write/update file di workspace **tidak diubah** atas keputusan user (sudah disandbox ke 1 folder).

## Files Changed
- `apps/api/src/modules/tools/services/data-query.tool.ts` — SQL guard: cek verb TERAKHIR (tutup bypass `WITH ... DELETE`), blokir `/* */`, validasi nama tabel di describeTable
- `apps/desktop/main.cjs` — `resolveInsideWorkspace()` containment untuk semua fs/office IPC + WS bridge path; binary ext ditambah (.pptx, .doc, .xlsm, .zip dll); `app:openPath` cek error string dari shell.openPath
- `apps/api/src/modules/interaction/desktop-bridge.service.ts` — stale socket ditutup saat reconnect; close handler hanya null-kan `desktop` jika socket itu sendiri
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — loop berhenti setelah `write_workspace_file` sukses (flag `fileWritten`); error stream di-propagate sebagai event; `waitForApproval` timeout 2 menit auto-reject
- `apps/api/src/modules/chat/agent-runner.service.ts` — `markFailed` di catch (lock turn dilepas); pesan jujur saat max rounds tercapai
- `apps/api/src/modules/chat/user-turn-transcript.service.ts` — state `failed` ditambahkan, `hasActiveTurn` tidak blokir failed
- `apps/api/src/modules/cron/cron.module.ts` + `cron.service.ts` — inject WorkspaceRunnerService; `executeAgentRun` benar-benar menjalankan agent (dulu no-op + TODO); in-memory job claim anti eksekusi ganda
- `apps/api/src/modules/memory/auto-memory.service.ts` — merge update primary in-place (dulu buat duplikat baru); distill deactivate memori sumber (count konvergen)
- `apps/api/src/modules/chat/session-state-events.service.ts` — sequence atomic `MAX+1` dalam INSERT; hapus getNextSequence (dead code)
- `apps/api/src/modules/memory/session-search.service.ts` + `smart-recall.service.ts` — FTS5 query di-escape sebagai phrase; regex marker fix `<<<>` → `<<<`
- `apps/web/src/pages/WorkspacePage.tsx` — stale closure `triggerAutoAnalysis` (deps + addMessageToActiveSession); AbortController untuk abort race; guard `!isAnalyzing` di heartbeat; try/catch IPC folder scan
- `apps/web/src/pages/WorkspaceDetailPage.tsx` — onerror `throw` (stop infinite SSE retry)
- `apps/web/src/pages/ChatPage.tsx` — hapus fabricated chat id (throw + toast error); double-send guard via `isPending`; dedupe optimistic by `temp-` prefix
- `apps/web/src/pages/KnowledgePage.tsx` — `res.ok` check di toggle/delete (dulu doc jadi `undefined` → crash)
- `apps/web/src/pages/SettingsPage.tsx` — `res.ok` check + toast error
- `apps/web/src/components/chat/CanvasPanel.tsx` — revokeObjectURL setelah download

## Tests
- `npx nest build` — ✅ exit 0
- `npx vitest run` (apps/api) — ✅ 10 files, 45 tests passed
- `npx tsc -b apps/web/tsconfig.json` — ✅ exit 0
- `npm run build` (apps/web) — ✅ built in 8.91s
- `node --check main.cjs` — ✅ exit 0
- SQL guard regression (temp script, 8 cases incl. `WITH ... DELETE`, nested subquery) — ✅ 8/8
- CI GitHub Actions (commit a42f051) — ✅ success

## Notes
- **Skipped atas keputusan user:** approval gate untuk `write_workspace_file`/`update_workspace_file` (auto-approve dibiarkan karena sandbox 1 folder)
- **Follow-up:** hardcoded fallback master key di `secrets-vault.service.ts:33-39` — menunggu keputusan user (vault juga belum diregister di module mana pun = dead code)
- Sebelumnya di sesi ini: fix CI npm bug #4828 (rollup-linux entry di lockfile), fix skills double prefix, FTS5 external-content → regular table
