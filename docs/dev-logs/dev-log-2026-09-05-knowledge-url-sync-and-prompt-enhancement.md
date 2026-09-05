# Dev Log — Knowledge Node URL Sync & Engine Prompt Enhancement

**Date & Time:** 2026-09-05 18:09:00 WIB
**Author:** Antigravity AI

## What
Fixed the issue where Arunaki failed to check data from a connected Google Sheets / website URL in the Knowledge Graph when asked in Chat:

1. **Root Cause Analysis**:
   - In `KnowledgeNodePanel.tsx`, when the user entered a Google Sheets link in "Base Website URL", only the `urls` array was updated. The `content` (Markdown textarea) was left as the default placeholder string `"Enter knowledge content here..."`.
   - The user understandably assumed that entering the link in Knowledge Graph meant Arunaki would automatically sync and read the file.
   - In `packages/engine/engine/src/session/system.ts`, the active nodes filter strictly required `n.content && n.content.trim().length > 0`, discarding nodes whose content was empty or placeholder, even if they had a valid URL.
   - Consequently, the LLM received no reference to the Product Catalog URL and merely ran local workspace file search (`grep` / `read`), finding no laptop data in the local folder `.txt` files.

2. **Fix Implemented**:
   - **Frontend UI (`KnowledgeNodePanel.tsx`)**:
     - Added an interactive **`Sync / Fetch Data`** button with spinner below the `Base Website URL` input. Clicking it automatically converts Google Sheets links to `/export?format=csv` (or fetches web pages) and immediately populates the `Knowledge Content (Markdown)` textarea with real data.
     - Enhanced `handleSave`: if `content` is empty or placeholder and a URL is provided, automatically fetches and extracts the Google Sheets CSV / page content before saving.
   - **Backend Handler (`packages/engine/.../knowledge.ts`)**:
     - Added server-side `fetchUrlContent` helper with automatic Google Sheets `/export?format=csv` transformation.
     - Enhanced `updateImpl`: if the client sends a node with URLs and placeholder/empty content (or previously corrupted "JavaScript tidak diaktifkan" HTML), automatically fetches the live CSV data.
   - **Engine System Prompt (`packages/engine/.../system.ts`)**:
     - Updated `activeNodes` filter to retain nodes that have valid URLs even if `content` was not yet filled.
     - Added strict priority instructions: the AI is directed to check `<knowledge_base>` first for catalogs/products/stock, use `browse_website` on the node's URL if not found locally, and NEVER conclude that data is missing without checking the connected knowledge nodes.
   - **Workspace Data Update**:
     - Synced `node-4` in `E:\JS\laporan-test\.arunaki\knowledge.json` with the actual Google Sheet CSV data (Laptop Asus Vivobook 14, Lenovo IdeaPad 3, PC Desktop, etc.).

## Files Changed
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx`
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts`
- `packages/engine/engine/src/session/system.ts`

## Tests & Verification
- `npm run build -w apps/web` — ✅ Passed (25.74s, 0 errors).
- Executed PATCH on `node-4` with live Google Sheet CSV — returned 200 OK, updated successfully.
