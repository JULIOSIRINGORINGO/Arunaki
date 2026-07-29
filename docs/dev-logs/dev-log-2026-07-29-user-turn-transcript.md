# Dev Log — User Turn Transcript (Layer 8)

**Date:** 2026-07-29
**Author:** AI Agent

## What
Implementasi User Turn Transcript (Layer 8) dari Blueprint P0 Idempotency:
- Lifecycle tracking service: created → sent_to_provider → runtime_persisted → approved
- Late media detection: `hasActiveTurn()` cegah concurrent requests
- Wiring ke AgentRunnerService (sync + stream)
- Cleanup stale turns otomatis (5 menit timeout)

## Files Changed
- `apps/api/src/modules/chat/user-turn-transcript.service.ts` — NEW: TurnTranscript type, lifecycle methods, late media, stale cleanup
- `apps/api/src/modules/chat/agent-runner.service.ts` — UPDATE: createTurn + lifecycle hooks di sync dan stream
- `apps/api/src/modules/chat/chat.controller.ts` — UPDATE: late media check sebelum agent run
- `apps/api/src/modules/chat/chat.module.ts` — UPDATE: register + export UserTurnTranscriptService
- `WORKFLOW.md` — UPDATE: 25.2 marked done
- `docs/FIXES-AND-GAPS.md` — UPDATE: Item B marked done
- `docs/dev-logs/dev-log-2026-07-29-user-turn-transcript.md` — NEW: this file

## Tests
- `npx tsc --noEmit` — ✅ 0 source errors

## Notes
- Transcript disimpan in-memory (Map), bukan DB — cukup untuk lifecycle tracking
- Timeout 300s (5 menit) — stale turns dibersihkan otomatis
- Late media detection return error 'TURN_IN_PROGRESS' — user harus tunggu
- Next: Item C (Merge Session Admission, Layer 6)
