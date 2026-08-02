# Dev Log — Stream Close on Error

**Date & Time:** 2026-08-02 23:42:00 WIB
**Author:** AI Agents

## What
UI stop loading dan tampilkan pesan kesalahan ketika stream SSE terputus.

## Files Changed
- `apps/web/src/pages/WorkspaceDetailPage.tsx` — `onerror`/`onclose` reset `isAgentRunning`, catat log, dan tampilkan pesan.

## Tests
- `npm run typecheck` — ✅ passed

## Notes
Penyebab utama agent “berhenti diam” adalah `fetchEventSource` melempar error tanpa menutup respons, sehingga UI tetap di status running.
