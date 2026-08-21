# Dev Log — Zero-Config Multi-Engine WebSearchTool & Core Search Tool Integration

**Date & Time:** 2026-08-21 19:07:00 WIB  
**Author:** Antigravity AI Agent

## What
Upgraded Arunaki's web search capability to parity with modern AI agents:
1. **Multi-Engine Search Architecture (`WebSearchTool`)**:
   - Engine 1: Tavily (if `TAVILY_API_KEY` is present).
   - Engine 2: Yahoo Web Search (Universal, zero API key required, unblocked across all regions including Indonesia).
   - Engine 3: Bing RSS Search (XML feed parsing for rich titles, links, and snippets).
   - Engine 4: Wikipedia / Knowledge REST API.
2. **Core Tool Registration (`ToolRegistryService`)**:
   - Added `'web_search'` directly to `coreToolNames` so that LLM always has `web_search` available on any turn.
   - Enhanced registrar description in `HarnessMetaToolsRegistrar` to guide LLMs on product, catalog, and general fact searches.

## Files Changed
- `apps/api/src/modules/tools/services/web-search.tool.ts`
- `apps/api/src/modules/tools/services/web-search.tool.spec.ts`
- `apps/api/src/modules/tools/tool-registry.service.ts`
- `apps/api/src/modules/tools/services/registrars/harness-meta-tools.registrar.ts`

## Tests Run & Results
- `npx vitest run apps/api/src/modules/tools/services/web-search.tool.spec.ts` — ✅ Passed (1.3s)
- `npx vitest run apps/api/src/modules/knowledge/services/knowledge-crawler.service.spec.ts` — ✅ Passed (4/4 tests)
- `npm run build -w apps/api` — ✅ Passed (0 errors)
- `npm run build -w apps/web` — ✅ Passed (0 errors)
