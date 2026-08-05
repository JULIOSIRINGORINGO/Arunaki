# Dev Log — Explicit Todo/Plan Tool untuk LLM (Gap #6)

**Date & Time:** 2026-08-05 10:35:00 WIB
**Author:** AI Software Engineer (opencode)

## What
Menutup Gap #6: menambah working-memory eksplisit untuk LLM berupa todo list per-run yang bisa ditulis lewat tool `todo_write` dan disuntikkan ke konteks di tiap round agent loop. Sebelumnya hanya ada event `plan_created` yang di-infer untuk UI (bukan tool yang bisa dipanggil LLM).

## Files Changed
- `apps/api/src/modules/tools/services/todo-store.service.ts` [NEW] — `TodoStoreService`: per-run store `set/get/clear/has/serialize`; interface `TodoItem { id, content, status }`; `serialize()` menghasilkan blok `=== TODO LIST ===`.
- `apps/api/src/modules/tools/tools-provider.module.ts` — tool `todo_write` (catalog-only) + provider/export `TodoStoreService`.
- `apps/api/src/modules/tools/tools.module.ts` — export `TodoStoreService`.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — clear todo di awal run; injeksi blok todo per round (in-place) sebelum `aiService.chat`.
- `apps/api/src/modules/chat/agent-runner.service.ts` — injeksi todo per round (sync + stream) dengan `todoRunId`; thread `runId` ke args tool.
- `apps/api/src/prompts/rules.md` — aturan `todo_write` untuk tugas multi-step (>3 langkah).
- `apps/api/src/modules/tools/services/todo-store.service.spec.ts` [NEW] — 3 test.
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — describe baru "todo list injection" (2-round, cek pesan system round 2).
- `WORKFLOW.md` — Phase 45.1.

## Tests
- `npx vitest run src/modules/tools/services/todo-store.service.spec.ts` — 3/3 passed.
- `npx vitest run src/modules/workspace/workspace-runner.service.spec.ts` — 7/7 passed.
- `npx vitest run src/modules/chat` — 10/10 passed (agent-runner constructor change).
- `npm run build` — 0 errors.

## Notes
- Fix test: provider `TodoStoreService` di describe paralel & instansiasi awalnya `new TodoStoreService()` (instance terpisah dari mock) — diganti `useValue` instance yang sama agar `todo_write` di mock menulis ke store yang di-inject.
- `todo_write` butuh array `todos` lengkap (bukan delta) — runner pakai `args.workspaceId || args.runId || 'default'` sebagai kunci per-run.
