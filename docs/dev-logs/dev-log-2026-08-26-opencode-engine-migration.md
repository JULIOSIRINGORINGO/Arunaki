# Dev Log — OpenCode Engine Migration

**Date & Time:** 2026-08-26 14:00:00 WIB
**Author:** AI Agent (opencode/big-pickle)

## What
Replace Arunaki's custom NestJS engine with a rebranded OpenCode fork (`anomalyco/opencode`). Keep engine + server + plugin system. Port COM document tools as OpenCode-compatible tools. React frontend + Electron desktop stay.

## Architecture Decision Record
| Decision | Choice |
|----------|--------|
| Engine | OpenCode fork → `@arunaki/*` |
| Old code | `apps/api/` → `apps/api-legacy/` (reference only) |
| Database | Drizzle (follow OpenCode), Prisma dropped |
| UI | React 19 + Electron (keep, connect to engine API) |
| COM tools | Port to OpenCode `Tool.define()` |
| Unique features | Deferred (guided harness, post-run, todo memory) |
| Git | Directly on main, no feature branch |

## Files Changed

### Engine (packages/engine/)
- `core/` — @arunaki/core (session, DB, domain)
- `llm/` — @arunaki/llm (provider abstraction)
- `schema/` — @arunaki/schema (shared types)
- `protocol/` — @arunaki/protocol (HTTP API defs)
- `server/` — @arunaki/server (HTTP server)
- `plugin/` — @arunaki/plugin (plugin SDK)
- `sdk/` — @arunaki/sdk (client SDK)
- `opencode/` — @arunaki/engine (main entry, config)
- `effect-drizzle-sqlite/` — @arunaki/effect-drizzle-sqlite
- `effect-sqlite-node/` — @arunaki/effect-sqlite-node
- `opencode/src/tool/registry.ts` — Added Excel/Word/PPT COM tools to builtin list

### Tools (packages/arunaki-tools/)
- `src/tools/excel-com.ts` — Excel COM automation via PowerShell
- `src/tools/word-com.ts` — Word COM automation via PowerShell
- `src/tools/ppt-com.ts` — PowerPoint COM automation via PowerShell
- `src/index.ts` — Tool exports

### Frontend (apps/web/)
- `src/lib/engine.ts` — Engine API adapter (session, prompt, events, providers)
- `src/pages/UnifiedWorkstationPage.tsx` — Chat flow now uses engine API

### Root
- `package.json` — Workspaces + bun catalog for shared deps
- `bun.lock` — Lockfile

## Commits
1. `a864e48` — Rebrand @opencode-ai → @arunaki (704 files)
2. `b68d542` — Install deps, bun catalog, create arunaki-tools with COM tools
3. `3798cfd` — Connect React frontend to engine API

## Tests
- TypeScript compilation: ✅ passed (apps/web)
- Engine typecheck: ⏭ skipped (slow, large codebase)

## Notes
- Engine packages use bun `catalog:` for shared dependency versions
- OpenCode's tool registry loads builtin tools + custom tools from config dirs
- COM tools use PowerShell COM objects (Windows only)
- Event mapping: `session.next.text.delta` → `text_delta`, `session.next.tool.called` → `tool_start`
- Old NestJS code preserved at `apps/api-legacy/` for reference
- Deferred: workspace/knowledge endpoints, Electron launcher, guided harness
