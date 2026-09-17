# Dev Log — Fix Knowledge Menu Routing, System Prompt Awareness, and Folder Isolation

**Date & Time:** 2026-09-17 18:21:00 WIB  
**Author:** Antigravity AI  

## What
Resolved critical issue where the agent didn't recognize data connected via the Knowledge menu and erroneously attempted to search across the hard drive (E:\ root drive) for a knowledge folder:

1. **Session Workspace Routing Bug Fixed (workspace-routing.ts)**:
   - planRequest was accessing session?.directory. In Session.Info, the active directory is stored under session.location.directory (location: Location.Ref).
   - Consequently, session?.directory returned undefined, causing requests to /api/session/:id/prompt without explicit directory query/headers to fall back to defaultDirectory (~/.arunaki/scratch).
   - In scratch mode, .arunaki/knowledge.json was empty, so the active knowledge base connected in the workspace was never passed to the AI in its prompt.
   - Updated workspace-routing.ts to properly extract (session?.location as any)?.directory || (session as any)?.directory || defaultDirectory(request, url).

2. **Frontend Engine Client Header Injection (pps/web/src/lib/engine.ts)**:
   - Updated engineFetch and sendPrompt to automatically include the x-arunaki-directory header from localStorage.getItem(arunaki_active_folder) (matching piFetch).

3. **Knowledge Base Prompt & Menu Awareness (system.ts & default.txt)**:
   - Explicitly clarified in system prompts that Knowledge is an Arunaki application feature/UI menu (/knowledge), **not a folder or file on disk**.
   - Strictly forbade the agent from executing shell/dir/ls or glob tools to look for a knowledge folder.
   - Enhanced connected data source injection to automatically convert Google Sheets URLs into direct CSV export URLs (/export?format=csv) so the model can immediately fetch live catalog/price data via webfetch.
   - Added friendly fallback messaging when no knowledge is connected, guiding users to the Knowledge menu in the top navigation bar instead of searching the hard drive.

4. **Strict Project Folder Isolation Guard (external-directory.ts)**:
   - Enforced hard boundary: if !containsPath(full, ins), reject immediately with Access denied: path is outside the active workspace folder.
   - Prevented tools from wandering outside the active project folder into parent drives or unrelated directories.

5. **Memory Routing Alignment (memory.ts)**:
   - Updated learnCorrection and onTurnCompleted to inspect session?.location?.directory as well.

## Files Changed
- pps/web/src/lib/engine.ts — Added x-arunaki-directory header to engineFetch and sendPrompt.
- packages/engine/engine/src/server/routes/instance/httpapi/middleware/workspace-routing.ts — Resolved session.location.directory extraction.
- packages/engine/engine/src/session/memory.ts — Added session.location.directory fallback.
- packages/engine/engine/src/session/prompt/default.txt — Added Knowledge Menu Awareness and strict folder isolation section.
- packages/engine/engine/src/session/system.ts — Injected Direct CSV Export URLs and Knowledge menu awareness.
- packages/engine/engine/src/tool/external-directory.ts — Strictly blocked tool operations outside the active project folder.

## Tests
- un build packages/engine/engine/src/session/system.ts --no-bundle — ✅ Passed.
- 
pm run build -w apps/web — ✅ Passed with 0 TypeScript compilation errors in 30.10s.
- 
ode scratch/test-endpoints.cjs — ✅ All 5 core API endpoints passed.
