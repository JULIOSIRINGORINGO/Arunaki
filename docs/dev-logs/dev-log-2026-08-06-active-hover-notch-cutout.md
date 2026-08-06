# Dev Log — Exact Active/Hover Notch Cutout & Top Header Emblem Match

**Date & Time:** 2026-08-06 09:31:10 WIB  
**Author:** AI Software Engineer  

## What
Updated active and hover states in `Sidebar.tsx` and `AppLayout.tsx` to 100% match the reference screenshots:
1. Sidebar Active & Hover States:
   - When hovering over or activating any menu item (e.g. Settings gear icon `Settings`), a white semi-circular tab notch cutout (`bg-white rounded-l-full`) appears attached on the left side of the dark vertical pill.
   - The button becomes a solid Coral Orange circle (`bg-[#FF5E38] text-white shadow-md scale-105`) with a crisp white icon (`text-white`) inside, exactly matching Image 1.
2. Top Header Emblem Badge:
   - Updated the far-right emblem badge in `AppLayout.tsx` to feature a white/cream horizontal tab cutout (`bg-white rounded-l-full`) with a Coral Orange circular badge (`bg-[#FF5E38]`) and white Arunaki logo inside, matching Image 2.

## Files Changed
- `apps/web/src/components/layout/Sidebar.tsx` — added group-hover and active notch cutout with coral orange button transition
- `apps/web/src/components/layout/AppLayout.tsx` — updated top-right emblem badge to white tab cutout with orange logo badge

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
