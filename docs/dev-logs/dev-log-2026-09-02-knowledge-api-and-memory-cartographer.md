# Dev Log — Knowledge API Wiring + Memory Cartographer/Sentinel

**Date & Time:** 2026-09-02 WIB
**Author:** opencode AI agent

## What
1. Wired the Knowledge menu (all 12 endpoints) from UI to the engine, following the exact existing UI contract — no UI files modified.
2. Reimplemented Phase 49-50 (ARUNAKI.md memory mechanism): cartographer + rules sentinel daemon in the engine's Effect stack.
3. Added `apiFetch` auto-`directoryQuery()` injection so KnowledgePage works without component edits.

## Files Changed
- `packages/engine/engine/src/server/routes/instance/httpapi/groups/knowledge.ts` — **NEW**: `KnowledgeApi` HTTP group (12 endpoints), `KnowledgeError = Schema.TaggedErrorClass`, schemas for `KnowledgeNode`, `KnowledgeEdge`, inputs.
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts` — **NEW**: handlers for all 12 endpoints, file-backed store at `<dir>/.arunaki/knowledge.json`, manual multipart upload parser, turndown-based compose.
- `packages/engine/engine/src/server/routes/instance/httpapi/api.ts` — registered `KnowledgeApi` via `addHttpApi` after `InstanceApi`.
- `packages/engine/engine/src/server/routes/instance/httpapi/server.ts` — registered `knowledgeHandlers` + `Memory.node` in app layer group.
- `packages/engine/engine/src/arunaki/memory.ts` — **NEW**: `Memory.Service` (cartographer + sentinel daemon), LayerNode wired into app group.
- `packages/engine/engine/src/session/instruction.ts:67` — added `.arunaki/ARUNAKI.md` to `instructionFiles` for system prompt injection.
- `apps/web/src/lib/api.ts` — `apiFetch` auto-appends `directoryQuery()` from `localStorage("arunaki_active_folder")`.
- `packages/engine/engine/test/server/httpapi-knowledge.test.ts` — **NEW**: end-to-end knowledge API test (CRUD, edges, upload).
- `WORKFLOW.md` — added engine reimplementation notes to Phases 49-50.

## Tests
- `bun test test/server/httpapi-knowledge.test.ts --timeout 45000` — ✅ 2 pass, 23 expect calls.
- `npm run build -w apps/web` — ✅ 0 TS errors, successful vite build.
- `bunx tsgo --noEmit` — ✅ 0 new errors from knowledge/memory files (pre-existing `@/effect/instance-state` + `HandlerWithName` patterns only).
- Pre-existing failures confirmed NOT caused by this work: `httpapi-instance.test.ts` "sync fence header" test (1 fail on clean tree), `httpapi-file.test.ts` "search index not ready" test (1 fail on clean tree).

## Notes
- **Knowledge store format**: `knowledge.json` stores `{ nodes, edges, nextId }`; `main-ai-node` (Agent Core) is seeded automatically; `arunaki-rulebook` node is dual-synced by the memory cartographer.
- **Compose/turndown**: uses existing `turndown` dep; HTTP fetch via `HttpClient.filterStatusOk`; timeout 30s.
- **Upload**: manual multipart boundary parsing (no new dep); only text content extracted (PDF/DOCX → empty — ponytail: defer extraction deps).
- **Memory sentinel**: subscribes `SessionEvent.Step.Ended`; rate-limited to 30s gap; fires via `BackgroundJob.start()` so the cartographer runs non-blocking and is cleaned up per-instance scope.
- **Cartographer synthesizer**: deterministic (no LLM credentials needed) — domain profile + file catalog + invariant section + placeholder learned corrections. Upgrade path noted in `ponytail:` comment; swap to `TaskTool` sub-agent when budgets allow.
- **ARUNAKI.md injection**: `findUp` resolves `.arunaki/ARUNAKI.md` from active directory upward (the nested relative path works due to glob with `dot: true`).
