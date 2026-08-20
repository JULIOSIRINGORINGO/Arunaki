# Dev Log — Live Document Preview & Workspace Bug Fixes

**Date & Time:** 2026-08-20 17:20:00 WIB
**Author:** Antigravity

## What
- Memperbaiki regresi di 7 tes unit `workspace-runner.service.spec.ts` terkait *mocking* `classifyIntent`, `WorkspaceRunStateService`, dan injeksi *dependency* pada `WorkspaceToolExecutorService`.
- Mengimplementasikan `LiveDocumentPreview.tsx` di frontend (`apps/web`) agar pengguna bisa melihat perubahan/pratinjau *file* teks maupun Excel secara seketika (*visible interaction* / *computer use UI*).
- Menyatukan pratinjau ini di bawah `LiveExecutionBadge` dalam obrolan UI (`WorkstationRightChat.tsx`).
- Seluruh kode berhasil di-build (`npm run build -w apps/web`).

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts`
- `apps/api/src/modules/workspace/services/workspace-tool-executor.service.ts`
- `apps/web/src/components/workstation/LiveDocumentPreview.tsx` [NEW]
- `apps/web/src/components/workstation/WorkstationRightChat.tsx`

## Tests
- `npx vitest run apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — ✅ passed (8/8)
- `npm run build -w apps/web` — ✅ passed

## Notes
- "Computer Use" untuk Arunaki sekarang memiliki komponen UI representatif. Jika backend mengeluarkan status `tool_live_status` (atau menyematkannya dalam riwayat via `liveStatus.preview`), antarmuka ini akan menampilkan sekilas pratinjau dokumen seperti *spreadsheet* mini atau blok teks.
