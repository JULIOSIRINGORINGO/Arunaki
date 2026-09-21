# Dev Log — Comprehensive i18n & View Menu Language Switcher

**Date & Time:** 2026-09-21 17:32:00 WIB
**Author:** Antigravity AI
**Branch:** feature/messaging-apps-gateway

## What
1. **View Menu Language Switcher:**
   - Added Language option section under Theme in `ViewMenu.tsx` with dedicated monochrome `EN` and `ID` badges and dynamic checkmarks.
   - Allows instant one-click switching between **English** and **Bahasa Indonesia**.
2. **Centralized i18n Module (`apps/web/src/lib/i18n.ts`):**
   - Implemented reactive `useI18n()` hook, `t(key, fallback)` function, and dictionary containing full bilingual translations.
   - Built with `window.dispatchEvent` for instant reactivity across all mounted components without needing a full-page reload.
   - Persists user choice in `localStorage` under `arunaki_language`.
3. **Comprehensive UI Translation Across Workstation:**
   - **TopMenuBar & Menus:** `FileMenu`, `EditMenu`, `ViewMenu`, `HelpMenu` labels and dropdown actions.
   - **Modals:** `AboutArunakiModal`, `KeyboardShortcutsModal`.
   - **Settings:** `SettingsPage` (navigation tabs, title, subtitle) and `SettingsMessagingTab` (BYOB Gateway labels, guides, and forms).
   - **Workstation Panels:** `WorkstationLeftExplorer` (headers, tooltips, empty state, error notices), `WorkstationRightChatHeader` (session titles and actions), `ChatInputBox` (placeholders, effort controls, mentions, slash commands), `CenterEmptyState`.
   - **AppLayout & Status Bar:** Header brand, quick theme tooltip, profile tooltip, navigation tabs (`Workstation`, `Knowledge`, `History`, `Settings`), active folder display, and online/offline network indicator.

## Files Changed
- `apps/web/src/lib/i18n.ts` — Created reactive i18n module with complete `en` and `id` dictionaries.
- `apps/web/src/components/layout/menu/ViewMenu.tsx` — Added Language selection and translated items.
- `apps/web/src/components/layout/menu/FileMenu.tsx` — Translated file actions and shortcuts.
- `apps/web/src/components/layout/menu/EditMenu.tsx` — Translated edit actions.
- `apps/web/src/components/layout/menu/HelpMenu.tsx` — Translated help items.
- `apps/web/src/components/layout/menu/AboutArunakiModal.tsx` — Translated modal descriptions and version info.
- `apps/web/src/components/layout/menu/KeyboardShortcutsModal.tsx` — Translated search and actions.
- `apps/web/src/components/layout/AppLayout.tsx` — Translated bottom nav capsule, folder indicator, and network status.
- `apps/web/src/pages/SettingsPage.tsx` — Translated settings tabs and headers.
- `apps/web/src/components/settings/SettingsMessagingTab.tsx` — Translated BYOB gateway cards, forms, and guide wizard.
- `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx` — Translated explorer header, actions, and fixed hook ordering.
- `apps/web/src/components/workstation/chat/WorkstationRightChatHeader.tsx` — Translated header session title and controls.
- `apps/web/src/components/workstation/chat/ChatInputBox.tsx` — Translated placeholder, reasoning effort options, and tooltips.
- `apps/web/src/components/workstation/tabs/CenterEmptyState.tsx` — Translated empty state text.

## Tests & Verification
- `npm run typecheck` (`tsc -b apps/web/tsconfig.json`) — ✅ passed (0 errors)
- `npm run build -w apps/web` — ✅ passed (0 errors, Vite bundle generated in 11.69s)

## Notes
- Strict adherence to monochrome palette and zero React Rules of Hooks regressions.
- Kept strictly on `feature/messaging-apps-gateway` without merging into `main`.
