# Dev Log — Remove Orange Circle Background & Orange Icon on Hover/Active

**Date & Time:** 2026-08-06 09:35:00 WIB  
**Author:** AI Software Engineer  

## What
Updated `Sidebar.tsx` to strictly conform to the user's updated 2-step directive:
1. Completely removed the solid orange circle background (`bg-[#FF5E38]`) on active or hover states. The button circle background stays dark base background (`bg-[#252428]`).
2. Made the **icon itself** turn Coral Orange (`text-[#FF5E38]`) when hovered or active!
3. The white semi-circular tab notch cutout (`bg-white rounded-l-full`) appears on the left when active or hovered.

## Files Changed
- `apps/web/src/components/layout/Sidebar.tsx` — removed orange button background and made icon color turn orange (`#FF5E38`) on hover/active

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
