# Dev Log — Audit Security Wiring Fixes

**Date & Time:** 2026-08-02 17:22:00 WIB
**Author:** Antigravity AI Agent

## What
Memperbaiki 7 temuan audit keamanan dari `LAPORAN_AUDIT_ARUNAKI.md`. Semua perbaikan adalah **wiring fixes** — tidak mengubah fungsionalitas, hanya mengaktifkan fitur keamanan yang sudah ditulis tapi tidak tersambung ke jalur eksekusi nyata.

## Temuan yang Diperbaiki

| # | Audit | Perbaikan |
|---|-------|-----------|
| 1.1 | AutoPostureDetector tidak aktif | Tambah `historyMessages` sebagai arg ke-4 ke `getSystemPrompt()` |
| 1.3 | Tool list duplikat di prompt workspace | Hapus `buildWorkspaceToolingSection()` (sudah ada via `{TOOL_LIST}`) |
| 2.1 | Approval gate dead code | Pisahkan `delete_workspace_file` dari `isSafeWorkspaceMutate` |
| 3.1 | Path validation tidak aktif | Tambah `workspaceId` sebagai arg ke-3 ke `executeWithHealing()` |
| 4.3 | Server listen di 0.0.0.0 | Ubah ke `127.0.0.1` (localhost only) |
| 5.1 | desktop_send_keys tanpa sanitasi | Tambah whitelist keyboard shortcuts |
| 5.3 | Desktop tools tanpa approval gate | Tambah 5 desktop tools ke `mutatingTools` |

## Files Changed
- `apps/api/src/modules/chat/agent-runner.service.ts` — Pass historyMessages ke getSystemPrompt (2 tempat)
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Fix approval gate + pass workspaceId ke executeWithHealing (4 tempat)
- `apps/api/src/modules/ai/ai.service.ts` — Hapus duplicate tool list section dari prompt
- `apps/api/src/modules/tools/tools-provider.module.ts` — Tambah keyboard whitelist di desktop_send_keys
- `apps/api/src/main.ts` — Ubah listen address ke 127.0.0.1

## Tests
- `npm run typecheck` — ✅ passed (0 errors, backend build + frontend tsc)
- `npm run test` — ✅ passed (13 test files, 56/56 tests)

## Notes
- Temuan 4.1 (SecretsVault tidak dipakai) dan 4.2 (nol auth guard) belum diperbaiki karena memerlukan perubahan arsitektur yang lebih besar dan perlu approval terpisah.
- Temuan 2.2 (delete tanpa backup/trash) belum diperbaiki — perlu desain trash/soft-delete system.
