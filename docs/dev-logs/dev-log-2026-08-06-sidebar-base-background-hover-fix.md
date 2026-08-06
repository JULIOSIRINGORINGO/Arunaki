# Dev Log — Base Background Hover State Fix

**Date & Time:** 2026-08-06 09:33:10 WIB  
**Author:** AI Software Engineer  

## What
Fixed hover state behavior in `Sidebar.tsx`:
1. Removed `group-hover:bg-[#FF5E38]` from inactive menu buttons so hovering over a button keeps its dark base background (`bg-[#252428] hover:bg-[#323136]`) instead of turning the button solid orange.
2. Kept the white semi-circular tab notch cutout (`bg-white rounded-l-full`) appearing on the left on hover (`group-hover:opacity-100`).
3. Solid Coral Orange background (`#FF5E38`) and white icon (`text-white`) are now applied ONLY when the item is explicitly ACTIVE (currently selected page tab).

## Files Changed
- `apps/web/src/components/layout/Sidebar.tsx` — updated hover background to stay dark base background while displaying white notch cutout

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
