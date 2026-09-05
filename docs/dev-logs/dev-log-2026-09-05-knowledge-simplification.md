# Dev Log — Knowledge Node Simplification & CSV Fallback

**Date & Time:** 2026-09-05 14:40:00 WIB
**Author:** Antigravity

## What
- Removed the confusing 'Fetch URL - Draft' button from the Knowledge UI.
- Simplified backend logic by removing the `/knowledge/compose` endpoint and puppeteer HTML scraping.
- Intercept Google Sheets URLs inside `fetchAsMarkdown` to automatically convert them to `/export?format=csv` for clean and fast table data extraction without JavaScript.
- Deleted the persistent `ekapan.md` from the scratchpad folder and removed the hardcoded `knowledge.json` fallback so the engine functions purely like an empty workspace when no folder is connected.

## Files Changed
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx` — removed UI buttons & states.
- `packages/engine/engine/src/server/routes/instance/httpapi/groups/knowledge.ts` — removed Compose schemas and API endpoints.
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts` — removed composeImpl, updated fetchAsMarkdown to intercept Google Sheets.
- `packages/engine/engine/src/session/system.ts` — removed hardcoded fallback.
- `.gitignore` — added `.arunaki/`.

## Tests
- UI E2E via browser subagent passed successfully.
- Frontend builds successfully (`npm run build -w apps/web`).

## Notes
Knowledge Node is now purely dynamic (fetches when the LLM needs it during chat) or can download clean CSVs for Google Sheets automatically. UI is much cleaner.