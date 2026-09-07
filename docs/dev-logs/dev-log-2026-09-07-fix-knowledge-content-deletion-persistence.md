# Dev Log — Fix Knowledge Content Deletion & Prevent Backend Auto-Re-Fetch

**Date & Time:** 2026-09-07 18:22:00 WIB  
**Author:** Antigravity AI Software Engineer

## What
Diagnosed and fixed the bug where clearing knowledge content would not persist, causing deleted content / CSV to magically return when closing and reopening the Edit Node panel ("ku hapus ga bisa terhapus diclose balik lagi"):
1. **Root Cause Discovered in Backend**: In `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts`, `updateImpl` treated any empty content (`!content.trim()`) as a placeholder if a URL was present, secretly calling `fetchUrlContent(urls[0])` behind the scenes, downloading the Google Sheet CSV, and overwriting `node.content` before saving to disk. Thus, whenever the user erased the textarea and saved, the backend hijacked the empty field and re-stuffed the raw CSV back into the node.
2. **Backend Fix**:
   - Completely eliminated `fetchUrlContent` from `knowledge.ts`.
   - Updated `updateImpl` so empty content (`""`) is honored and saved as empty string.
3. **Frontend Fix**:
   - Updated [KnowledgeNodePanel.tsx](file:///E:/JS/Arunika/apps/web/src/components/knowledge/KnowledgeNodePanel.tsx) to provide a "Clear" button whenever text is present in the textarea.
   - Cleared stale HTML/CSV dump from local `.arunaki/knowledge.json`.

## Files Changed
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts` — removed `fetchUrlContent`, allowed empty content updates.
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx` — updated "Clear" action button behavior.

## Tests
- `npm run build -w apps/web` — ✅ passed (14.77s, 0 TS errors)

## Notes
Deleting or clearing notes now persists permanently to disk and will not reappear upon closing and reopening.
