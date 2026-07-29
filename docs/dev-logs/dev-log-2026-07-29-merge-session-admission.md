# Dev Log — Merge Session Admission Duplikasi (Layer 6)

**Date:** 2026-07-29
**Author:** AI Agent

## What
Merge duplikasi Session Admission Service — Layer 6 dari Blueprint P0 Consistency:
- `chat/session-admission.service.ts` ditingkatkan dengan fitur dari versi `ai/`
- Menambahkan `run<T>(fn)` helper (auto-release setelah callback)
- Menambahkan `isAdmitted()` + `getQueueLength()` methods
- Menambahkan `OnModuleDestroy` — reject semua queued requests saat shutdown
- Menghapus `ai/session-admission.service.ts` (orphaned — tidak diimport siapapun)
- `AgentRunnerService` tetap pake `acquireAdmission()` — API backward compatible

## Files Changed
- `apps/api/src/modules/chat/session-admission.service.ts` — UPDATE: merge fitur dari ai/
- `apps/api/src/modules/ai/session-admission.service.ts` — DELETED: orphaned duplicate
- `WORKFLOW.md` — UPDATE: 25.3 marked done
- `docs/FIXES-AND-GAPS.md` — UPDATE: Item C marked done
- `docs/dev-logs/dev-log-2026-07-29-merge-session-admission.md` — NEW: this file

## Tests
- `npx tsc --noEmit` — ✅ 0 source errors

## Notes
- Phase 25 (Blueprint P0 Security) sekarang ✅ SELESAI (A + B + C)
- Next: Phase 3 — Session State Events (Layer 7) atau Harness Registry (Layer 5)
