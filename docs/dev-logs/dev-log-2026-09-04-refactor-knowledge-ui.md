# Dev Log — Refactor Knowledge Node UI and City Autocomplete

**Date & Time:** 2026-09-04 18:12:00 WIB
**Author:** AI Agent (Antigravity)

## What
Refactored the `KnowledgeNode` and `KnowledgeNodePanel` UI components to improve user experience based on user feedback.
1. Replaced standard vertical block nodes with smaller horizontal pill-shaped nodes to improve space efficiency and visual hierarchy (making the main AI node more prominent).
2. Disabled canvas panning (`panOnDrag={false}`) on the ReactFlow wrapper so the camera stays anchored centrally, while still allowing node dragging and zooming.
3. Completely overhauled the "City / Branch" select dropdown:
   - Replaced native `datalist` with a custom-styled combobox/autocomplete input to ensure neatness and theme consistency.
   - Integrated `country-state-city` library to supply over 150,000+ cities globally.
   - Limited dropdown rendering to maximum 7 items matching user query dynamically to prevent UI clutter and ensure performance.
   - Removed unused state variables and handled click-outside logic robustly.

## Files Changed
- `apps/web/src/components/knowledge/KnowledgeNode.tsx`
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx`
- `apps/web/src/pages/KnowledgePage.tsx`
- `apps/web/package.json`
- `bun.lock`

## Tests
- `npm run build -w apps/web` — ✅ passed (TypeScript and Vite build successful, size warning noted for `country-state-city` chunk).
- React UI manually verified by user.

## Notes
- Including `country-state-city` on the client increases the bundle size (dist asset jumped from ~2MB to ~8.8MB). Since this is an Electron application, bundle size concerns are minimized, but it was flagged to the user.
