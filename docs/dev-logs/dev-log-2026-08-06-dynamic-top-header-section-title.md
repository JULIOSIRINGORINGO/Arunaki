# Dev Log — Dynamic Header Section Title Based on Active Route

**Date & Time:** 2026-08-06 10:24:55 WIB  
**Author:** AI Software Engineer  

## What
Made the top header capsule section title dynamic in `AppLayout.tsx`:

1. **Dynamic Title Mapping**:
   - `/` (Main AI Chat) -> `CHAT`
   - `/workspace` -> `WORKSPACE`
   - `/knowledge` -> `PENGETAHUAN`
   - `/history` -> `RIWAYAT CHAT`
   - `/settings` -> `PENGATURAN`
   - `/profile` -> `PROFIL`
2. **Auto-updating Header**: As the user navigates between sidebar options, the orange header title updates instantly.

## Files Changed
- `apps/web/src/components/layout/AppLayout.tsx` — added `useLocation` hook and `getPageTitle()` mapping

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
