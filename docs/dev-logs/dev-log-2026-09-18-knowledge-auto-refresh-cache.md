# Dev Log — Knowledge Auto-Refresh & Local Snapshot Caching

**Date & Time:** 2026-09-18 19:32:00 WIB  
**Author:** Antigravity AI Software Engineer

## What
Implemented zero-friction, automatic synchronization and local caching of connected Knowledge sources (Google Sheets catalogs, product price lists, inventory URLs) across three automated triggers, fully achieving the "Minimal Typing, Maximum Automation" principle:
1. **Multi-Trigger Automatic Sync Orchestration**:
   - **App Launch Trigger**: Silently checks and syncs active knowledge sources on startup in `App.tsx` (non-blocking).
   - **Workspace Switch Trigger**: Automatically syncs knowledge for the newly opened folder whenever the user opens/switches folders in `AppLayout.tsx`.
   - **Periodic & Focus Sync Trigger**: Background timer every 30 minutes, plus window focus detection if data is stale (> 15 minutes), ensuring long-running sessions stay updated without user effort.
2. **Backend Engine Route & Snapshot Store**:
   - Added `POST /knowledge/sync` endpoint in `groups/knowledge.ts` and `handlers/knowledge.ts`.
   - Converts Google Sheets URLs to direct CSV export URLs (`https://docs.google.com/spreadsheets/d/<id>/export?format=csv<gid>`).
   - Fetches CSV via HTTP and saves it locally in `<workspace>/.arunaki/cache/<nodeId>.csv`.
   - Records `lastSyncedAt` timestamp and `syncStatus` ("success" / "failed") on the node record in `.arunaki/knowledge.json`.
   - Isolates cached CSV completely from user manual notes (`node.content`), preventing previous bugs where raw CSV dumps polluted manual note textareas.
3. **Engine Context Pre-loading (`system.ts`)**:
   - Reads `.arunaki/cache/<nodeId>.csv` and pre-loads up to 250 rows / 30KB directly inside `<knowledge_base>` tags.
   - Instructs LLM that catalog data is already pre-loaded in context, eliminating slow runtime `webfetch` tool calls when users ask to "rekap ke excel" or check prices.
4. **Resilience & Offline Fallback**:
   - If offline or Google Sheets is unreachable, the system gracefully uses the existing local cache snapshot so document automation continues without interruption.
5. **UI Node Panel Awareness**:
   - Added auto-synced live badge with last-sync timestamp and status indicator in `KnowledgeNodePanel.tsx`.

## Files Changed
- `packages/engine/engine/src/server/routes/instance/httpapi/groups/knowledge.ts` — Added `SyncKnowledgeResponse` and `POST /knowledge/sync` endpoint.
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts` — Added `syncImpl`, `toGoogleSheetsCsvUrl`, and `lastSyncedAt` / `syncStatus` support.
- `packages/engine/engine/src/session/system.ts` — Injected cached live data into `<knowledge_base>` and updated prompt instructions.
- `apps/web/src/lib/knowledgeSync.ts` — Created orchestration utility for multi-trigger sync with mutex and debounce.
- `apps/web/src/App.tsx` — Trigger 1: App launch background auto-sync.
- `apps/web/src/components/layout/AppLayout.tsx` — Trigger 2 (folder switch) and Trigger 3 (periodic + focus sync).
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx` — Added sync subscription and auto-synced status display.
- `packages/engine/engine/test/server/httpapi-knowledge.test.ts` — Added sync endpoint and full caching integration tests.
- `WORKFLOW.md` — Marked Phase 104 as completed.

## Tests
- `bun test packages/engine/engine/test/server/httpapi-knowledge.test.ts` — ✅ 4 passed (node CRUD, upload, empty sync, mock server caching & disk persistence).
- `npm run typecheck` — ✅ 0 TypeScript errors.
- `npm run build -w apps/web` — ✅ 0 errors (built in 11.06s).

## Notes
The user now has zero manual maintenance: they connect their Google Sheet once, and every time the app opens or switches workspaces, Arunaki silently keeps all catalog prices, stock, and descriptions up-to-date and instantly available to the AI.
