# Dev Log — Distinct Sidebar Menu Icons & Dynamic Active Notch

**Date & Time:** 2026-08-06 09:29:40 WIB  
**Author:** AI Software Engineer  

## What
Updated the left sidebar navigation icons to use unique, menu-specific icons matching each feature instead of repeating the Arunaki brand logo everywhere:
1. Top Standalone Badge: Arunaki Brand Logo (`ArunakiLogo`)
2. Workspace Menu: `Folder` icon
3. Knowledge Base Menu: `BookOpen` icon
4. History Menu: `History` icon
5. Popup Chat Menu: `MessageSquare` icon
6. Settings Menu: `Settings` icon
7. Dynamic Notch Cutout: Made the white active notch cutout indicator dynamically follow whichever menu tab is active (`isWorkspaceActive`, `isKnowledgeActive`, `isHistoryActive`, `isSettingsActive`).

## Files Changed
- `apps/web/src/components/layout/Sidebar.tsx` — updated menu items to use distinct Lucide icons and dynamic active notch indicator

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
