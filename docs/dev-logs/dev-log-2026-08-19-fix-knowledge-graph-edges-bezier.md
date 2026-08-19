# Dev Log — Fix Knowledge Graph Connecting Edges (Smooth Bezier Curves)

**Date & Time:** 2026-08-19 11:26:30 WIB
**Author:** Antigravity AI

## What
Fixed the connecting lines (edges) on the Knowledge Graph canvas to eliminate the pixelated/jagged dashed lines and replace them with **sleek, continuous, solid bezier curves** matching the visual reference (n8n/Flowise).

### Changes Made:
1. **Edge Geometry & Animation**:
   - Replaced `type: 'smoothstep'` with `type: 'bezier'` for natural organic curved routing between left/right connection ports.
   - Removed `animated: true` (which was causing awkward disjointed SVG stroke-dasharray animation on short lines).
   - Removed oversized arrowhead markers in favor of clean direct port-to-port wire connections.
   - Set stroke color to responsive theme values (`#94A3B8` on light, `#475569` on dark) with 2px stroke width.
2. **Handle Port Decluttering**:
   - Removed redundant top and bottom handle dots from the standard card nodes.
   - Kept only clean left input and right output port connectors (`w-2.5 h-2.5`) with hover expansion and border accent styling.

## Files Changed
- `apps/web/src/pages/KnowledgePage.tsx`
- `apps/web/src/components/knowledge/KnowledgeNode.tsx`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2201 modules transformed)
