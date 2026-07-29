# Dev Log — Input Provenance (Layer 9)

**Date:** 2026-07-29
**Author:** AI Agent

## What
Implementasi Input Provenance (Layer 9) dari Blueprint P0 Security:
- Factory methods untuk `external_user`, `internal_system`, `inter_session`
- Inter-session annotation prefix + stripping utility
- Wiring ke `message.service.ts` dan `chat.controller.ts`

## Files Changed
- `apps/api/src/modules/ai/input-provenance.ts` — NEW: tipe, factory, annotation utilities
- `apps/api/src/modules/chat/message.service.ts` — UPDATE: pake InputProvenanceFactory
- `apps/api/src/modules/chat/chat.controller.ts` — UPDATE: ganti inline provenance ke factory
- `WORKFLOW.md` — ADD: Phase 25
- `docs/FIXES-AND-GAPS.md` — UPDATE: Item A marked done
- `docs/dev-logs/dev-log-2026-07-29-input-provenance.md` — NEW: this file

## Tests
- `npx tsc --noEmit` — ✅ 0 errors (excluding pre-existing spec file issues)

## Notes
- Inter-session annotation (`annotateInterSession`) belum terpakai karena belum ada cross-session routing — tapi utility sudah siap
- Frontend stripping (`stripInterSessionPrefix`) sudah disediakan di API layer
- Next: Item B (User Turn Transcript, Layer 8)
