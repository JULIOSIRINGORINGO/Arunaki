# Dev Log — Dead-Centered Top Arunaki Brand Logo Badge

**Date & Time:** 2026-08-06 10:13:05 WIB  
**Author:** AI Software Engineer  

## What
Fixed vertical axis alignment of top circular Arunaki brand badge:

1. **Removed Offset Flex Gap**: When collapsed (`!isExpanded`), removed `gap-3` and text wrapper nodes from the top button child container so `<ArunakiLogo />` sits 100% dead-centered inside the 56px (`w-14 h-14`) circular badge.
2. **Aligned Vertical Axes**: Top circular badge and middle/bottom capsules now share the exact same vertical center axis line.

## Files Changed
- `apps/web/src/components/layout/Sidebar.tsx` — updated top brand button flex wrapper styling

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
