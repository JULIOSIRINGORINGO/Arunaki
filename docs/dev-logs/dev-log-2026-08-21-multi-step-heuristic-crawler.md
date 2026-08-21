# Dev Log — Multi-Step Heuristic Fallback Web Crawler & GitHub Smart Resolver

**Date & Time:** 2026-08-21 18:55:00 WIB  
**Author:** Antigravity AI Agent

## What
Upgraded `KnowledgeCrawlerService` and `KnowledgeLiveFetchTool` with a multi-step heuristic fallback pipeline:
1. **GitHub Smart Resolver**:
   - Parses repository owner, repo, branch, and target path.
   - Automatically probes raw documentation patterns (`SKILL.md`, `README.md`, subfolders).
   - Queries GitHub Public Trees API to locate repositioned files (e.g. `skills/productivity/grill-me/SKILL.md`).
2. **Search-Based Heuristic Fallback**:
   - When a direct HTTP fetch returns 404 or empty content, automatically queries DuckDuckGo search to discover live working alternative URLs and fetch them.
3. **Headless Browser Fallback**:
   - Renders client-side JavaScript SPAs via Playwright if static HTML is empty.

## Files Changed
- `apps/api/src/modules/knowledge/services/knowledge-crawler.service.ts`
- `apps/api/src/modules/knowledge/services/knowledge-crawler.service.spec.ts`

## Tests Run & Results
- `npx vitest run apps/api/src/modules/knowledge/services/knowledge-crawler.service.spec.ts` — ✅ Passed (4/4 tests, 2.05s)
  - Test 1: Auto-resolves repositioned GitHub subfolder (Matt Pocock grill-me)
  - Test 2: Auto-resolves GitHub root repository README.md
  - Test 3: Direct HTTP fetch on normal public webpage
  - Test 4: KnowledgeLiveFetchTool E2E execution with smart fallback
- `npm run build -w apps/api` — ✅ Passed (0 errors)
- `npm run build -w apps/web` — ✅ Passed (0 errors)
