# Dev Log — Parallel Tool Execution Consistency (Gap #1)

**Date & Time:** 2026-08-05 10:25 WIB
**Author:** opencode (big-pickle)

## What
Perbaiki gap #1 dari `GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md`: eksekusi tool paralel tidak konsisten antar jalur.

## Files Changed
- `apps/api/src/modules/chat/agent-runner.service.ts` — sync path `runAgentSyncInternal`: `for` sequential → `Promise.all`. Semua `onToolStart` di-emit dulu (urutan), eksekusi paralel, hasil di-emit dalam urutan `tool_calls` asli agar `tool_call_id` konsisten.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — read-only tools (mode utama: Excel/Word hosting) `for` sequential → `Promise.all` via `executeWithHealing`; urutan hasil dipertahankan. Mutating tools tetap sequential (dependensi antar tool). Komentar menyesatkan diganti.
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — test baru: 3 read-only calls independen, assert `maxActive > 1` (paralel) + urutan `tool_done` + event `parallel (...)`.
- `WORKFLOW.md` — Phase 45.0.

## Tests
- `npx vitest run src/modules/workspace/workspace-runner.service.spec.ts` — ✅ 6 passed.
- `npx vitest run src/modules/chat` — ✅ 10 passed (2 files).
- `npm run build` (apps/api) — ✅ 0 errors.

## Notes
- Gap #5 & #7 diverifikasi di sesi sebelumnya (#5 salah/berfungsi, #7 setengah — boolean/object sudah ditutup).
- Gap #6 berikutnya: tidak ada explicit todo/plan tool untuk LLM.
