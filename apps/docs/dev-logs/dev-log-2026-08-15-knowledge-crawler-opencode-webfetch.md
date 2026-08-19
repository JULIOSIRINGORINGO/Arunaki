# Dev Log — Knowledge Crawler: HTTP+Turndown (1:1 opencode webfetch)

**Date & Time:** 2026-08-15 12:00:00 WIB
**Author:** big-pickle

## What
Replaced Playwright-based Knowledge crawler with lightweight HTTP fetch + Turndown (HTML→Markdown). 1:1 match with opencode's built-in webfetch tool. No browser, no Crawlee — fastest possible approach.

## Files Changed
- `apps/api/src/modules/knowledge/services/knowledge-crawler.service.ts` — Rewritten: HTTP fetch + Turndown, same interface as opencode webfetch (url, format, timeout)
- `apps/api/src/modules/tools/services/knowledge-live-fetch.tool.ts` — Updated: accepts format (markdown/text/html), timeout, url-only required
- `apps/api/src/modules/tools/services/knowledge-builder.tool.ts` — Deleted (dead code)
- `apps/api/src/modules/tools/services/knowledge-search.tool.ts` — Deleted (dead code)
- `apps/api/src/prompts/chat-knowledge-builder.md` — Deleted (dead code)
- `apps/api/src/modules/tools/tools-provider.module.ts` — Cleaned dead imports
- `apps/api/src/modules/tools/tool-registry.service.ts` — Removed `search_knowledge_graph` from coreToolNames
- `apps/api/src/modules/tools/services/registrars/harness-meta-tools.registrar.ts` — Cleaned dead import
- `apps/api/package.json` — Removed `crawlee` dependency

## Tests
- `npx nest build` — ✅ clean (0 errors)

## Notes
- Interface matches opencode webfetch 1:1: url (required), format (markdown/text/html, default markdown), timeout (optional, max 120s)
- Cloudflare retry: if 403 + cf-mitigated challenge → retry with `User-Agent: opencode`
- Max response size: 5MB (same as opencode)
- 5-minute in-memory cache for repeated fetches
- Removed hardcoded badge/table extraction (not opencode-compatible) — let LLM parse the content
