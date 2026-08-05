# Dev Log — Run-Level Token Budget (Gap #9)

**Date & Time:** 2026-08-05 11:20 WIB
**Author:** opencode AI Agent

## What
Menambahkan enforcement cost/token budget di level run. Sebelumnya MAX_ROUNDS (workspace 25, chat 5) membatasi jumlah putaran tapi bukan total token, dan sub-agent yang di-spawn paralel tidak terhitung biayanya. Sekarang seluruh run (parent + sub-agent) berbagi satu pool token via AsyncLocalStorage; run berhenti dengan pesan jelas saat budget terlampaui.

## Files Changed
- `apps/api/src/modules/ai/token-budget.service.ts` — BARU. `RunTokenBudget` (used/limit/remaining/exceeded, consume abaikan non-finite/≤0), `createRunBudget` (limit dari `RUN_TOKEN_BUDGET` env, default 200_000), `enterRunBudget`/`currentRunBudget` via `AsyncLocalStorage`.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — budget dibuat + di-enter di awal generator; consume `usage.totalTokens` tiap round; stop run + `onEvent` error saat exceeded.
- `apps/api/src/modules/chat/agent-runner.service.ts` — wiring budget di jalur sync (`runAgentSyncInternal`) dan stream (`runAgentStreamInternal`); consume tiap round, stop saat exceeded (stream: `onEvent` error; sync: via `finalContent`).
- `apps/api/src/modules/chat/sub-agent-runner.service.ts` — sub-agent consume dari `currentRunBudget()` (mewarisi pool parent via ALS); berhenti saat pool habis.
- `apps/api/src/modules/ai/token-budget.service.spec.ts` — BARU, 5 test.
- `WORKFLOW.md` — Phase 45.6.

## Tests
- `npx vitest run src/modules/ai/token-budget.service.spec.ts` — ✅ 5/5
- `npx vitest run src/modules/workspace src/modules/chat` — ✅ pass
- `npx vitest run` (full api) — ✅ 113/113
- `npm run build` — ✅ 0 errors

## Notes
- Budget threshold dikonfigurasi via env `RUN_TOKEN_BUDGET` (default 200_000 token). Tidak ada UI/settings untuk ini — cukup env.
- Desain: AsyncLocalStorage `enterWith` membuat sub-agent yang di-spawn dalam run (via `agent_spawn`) otomatis mewarisi budget parent — satu pool, tanpa perlu meneruskan argumen.
- Follow-up: pesan "budget terlampaui" belum di-emit sebagai event khusus; masih memakai `error`. Jika UI perlu menampilkan progress budget (used/limit) secara live, tambahkan event `budget_updated` di kemudian hari.
