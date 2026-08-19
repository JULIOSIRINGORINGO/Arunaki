# Dev Log — Enforce Strict Knowledge Graph Connectivity Requirement

**Date & Time:** 2026-08-19 11:33:30 WIB
**Author:** Antigravity AI

## What
Implemented a strict **Graph Connectivity Reachability** rule for Arunaki AI. A knowledge node is now strictly accessible to Arunaki only if it is actively connected to the central **Arunaki AI core node** (`main-ai-node`) directly or via an active graph path.

### Backend Implementation:
1. **BFS Graph Reachability Algorithm** in `KnowledgeRepository.findActiveWithEdges()`:
   - Evaluates all active nodes and edges.
   - Runs Breadth-First Search (BFS) starting strictly from `main-ai-node`.
   - Any disconnected / orphan nodes on the canvas that do not have a path to Arunaki are excluded from the reachable set.
2. **Context & Search Isolation** in `KnowledgeService`:
   - `getKnowledgeMap()` now only indexes documents that are reachable from Arunaki AI.
   - `searchNodes(query)` will return `'No data found'` if a query targets a document not connected to Arunaki AI.
   - Connecting a node on the canvas instantly grants Arunaki AI access to that knowledge; disconnecting or deleting the wire revokes access immediately.

## Files Changed
- `apps/api/src/modules/knowledge/knowledge.repository.ts`
- `apps/api/src/modules/knowledge/knowledge.service.ts`

## Tests
- `npm run build -w apps/api` — ✅ passed (0 errors)
- `npm run build -w apps/web` — ✅ passed (0 errors)
