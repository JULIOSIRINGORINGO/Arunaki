# Dev Log — Remove Protruding Notch Cutouts

**Date & Time:** 2026-08-06 09:35:50 WIB  
**Author:** AI Software Engineer  

## What
Removed the white semi-circular tab notch cutout shapes that were protruding on the left side of the sidebar pill in `Sidebar.tsx`:
1. Completely removed the `absolute -left-3.5 w-3.5 h-10 bg-white rounded-l-full` elements sticking out on the left.
2. The sidebar pill is now a clean, smooth, modern capsule shape with zero protrusions on the sides.
3. On hover/active, the menu icon smooth-scales and turns Coral Orange (`#FF5E38`) directly inside its dark base button container (`#252428`).

## Files Changed
- `apps/web/src/components/layout/Sidebar.tsx` — removed protruding white notch elements for a clean capsule sidebar

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
