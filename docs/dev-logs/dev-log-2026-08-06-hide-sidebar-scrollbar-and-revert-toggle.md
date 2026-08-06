# Dev Log — Hide Sidebar Scrollbar & Revert Toggle Behavior

**Date & Time:** 2026-08-06 10:16:10 WIB  
**Author:** AI Software Engineer  

## What
Removed scrollbar artifacts and restored clean static 3-capsule sidebar:

1. **Removed Toggle Functionality**: Removed open/close sidebar expansion state per user directive, restoring the static, clean 3-capsule vertical layout.
2. **Hidden Scrollbar Utility**: Added `[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden` to middle navigation container to prevent browser scrollbars or scroll arrows from appearing over the rounded bottom curve.

## Files Changed
- `apps/web/src/components/layout/Sidebar.tsx` — hidden scrollbars and restored static 3-capsule layout

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
