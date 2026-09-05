# Dev Log — Hide ARUNAKI.md From Knowledge Canvas UI

**Date & Time:** 2026-09-05 15:30:00 WIB
**Author:** Antigravity

## What
- Prevented `ARUNAKI.md (Living Rules)` from auto-injecting into the Knowledge Canvas UI.
- Removed `syncKnowledge` dual-sync logic from `packages/engine/engine/src/arunaki/memory.ts`. The living rules system still operates normally in the background (`.arunaki/ARUNAKI.md` is read by `instruction.ts` for LLM system prompts and updated by sentinel/cartographer), but it is no longer written to `.arunaki/knowledge.json`.
- Added defense-in-depth filtering in both `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts` (list & listEdges endpoints) and `apps/web/src/pages/KnowledgePage.tsx` so any legacy `arunaki-rulebook` node is omitted from the UI graph canvas.

## Files Changed
- `packages/engine/engine/src/arunaki/memory.ts` — removed `syncKnowledge` function, removed unused constants and types.
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts` — filtered out `arunaki-rulebook` / `rules` nodes and edges from listing endpoints.
- `apps/web/src/pages/KnowledgePage.tsx` — filtered out `arunaki-rulebook` / `rules` nodes and edges on client load.

## Tests
- `npm run typecheck` (`tsc -b apps/web/tsconfig.json`) — ✅ passed (0 errors)
- `npm run build -w apps/web` — ✅ passed (0 errors)
- Tested backend `/api/knowledge` and `/api/health` endpoints via HTTP — ✅ passed (200 OK, rulebook excluded)

## Notes
ARUNAKI.md continues to function as the internal living rules memory in the backend, while the Knowledge Canvas UI remains clean and uncluttered for user-managed knowledge nodes only.
