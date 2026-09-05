# Dev Log — Fix Knowledge Master Node Missing in Electron

**Date & Time:** 2026-09-05 17:38:00 WIB
**Author:** Antigravity AI

## What
Diagnosed and resolved the root cause of the Knowledge graph's master node (`main-ai-node` / Agent Core) appearing missing or invisible in Electron:

1. **Root Cause Analysis**:
   - In commit `032681b`, keep-alive logic was added across all sub-pages in `AppLayout.tsx` using `<div className={cn("...", location.pathname !== "/knowledge" && "hidden")}><KnowledgePage /></div>`.
   - Electron always boots with initial URL `http://127.0.0.1:5173/` (`/`, Workstation). As a result, `<KnowledgePage />` was mounted at app boot inside a container with `display: none` (`hidden`), where container dimensions were `0x0`.
   - `@xyflow/react` (React Flow) attempted to initialize its viewport and execute `setCenter` / `fitView` inside `setTimeout(..., 100)` while the DOM dimensions were 0px width and 0px height. This resulted in `NaN` transform coordinates (`transform: translate(NaNpx, NaNpx) scale(NaN)`).
   - When the user subsequently clicked the "Knowledge" tab, `hidden` was removed, but ReactFlow was not re-mounted and did not recalibrate its viewport. Furthermore, `panOnDrag={false}` prevented the user from panning to recover view coordinates.
   - Additionally, `ArunakiLogo` in `KnowledgeNode.tsx` lacked an explicit `size` prop (relied on `w-16 h-16`), which could fail to maintain aspect-ratio/dimensions inside SVG nodes.

2. **Fix Implemented**:
   - **`AppLayout.tsx`**: Restored clean active mounting for sub-pages (`{location.pathname === "/knowledge" && <KnowledgePage />}`) while preserving full keep-alive for `UnifiedWorkstationPage` (so editor tabs and chat sessions remain cached without latency).
   - **`KnowledgePage.tsx`**:
     - Added a client-side guarantee/fallback: if `main-ai-node` is not present in the backend response, automatically prepend it so the master node is never missing.
     - Enabled canvas panning (`panOnDrag={true}`) so users can freely explore their graph.
     - Added an `arunaki-folder-change` event listener so opening a new folder refreshes the graph nodes seamlessly.
     - Adjusted `setCenter` timing and duration for smooth camera focus on the master node.
   - **`KnowledgeNode.tsx`**: Provided explicit `size={64}` to `ArunakiLogo` for guaranteed 64x64 SVG layout dimensions.

## Files Changed
- `apps/web/src/components/layout/AppLayout.tsx`
- `apps/web/src/pages/KnowledgePage.tsx`
- `apps/web/src/components/knowledge/KnowledgeNode.tsx`

## Tests & Verification
- `npm run build -w apps/web` — ✅ Built cleanly in 21.32s with 0 errors.
- Verified backend `/api/knowledge` payload compatibility.
