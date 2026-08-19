# Dev Log — Fix Light Mode Theme Consistency Across Components & Titlebar

**Date & Time:** 2026-08-19 11:05:00 WIB
**Author:** Antigravity AI

## What
Diagnosed and fixed the issue where parts of the application remained completely dark/black when Light Mode was active (specifically the Left File Explorer tree, modals, status badges, provider cards, and the native Electron window controls overlay).

### Root Cause
1. **Hardcoded CSS in File Explorer**: `FileTree.tsx`, `TreeNodeItem.tsx`, and `tree-utils.tsx` were using hardcoded hex background colors (`bg-[#121212]`, `bg-[#161616]`, `hover:bg-[#1E1E1E]`, `text-[#FFFFFF]`, `text-[#E5E5E5]`, `text-[#A3A3A3]`) instead of CSS custom properties (variables) defined in `index.css` for light/dark themes (`--bg-panel`, `--bg-panel-sub`, `--bg-card`, `--bg-hover`, `--border-color`, `--text-primary`, etc.).
2. **Hardcoded Dark Window Controls Overlay in Electron**: In `apps/desktop/main.cjs`, `titleBarOverlay` was hardcoded to dark (`color: '#121212', symbolColor: '#ffffff'`).
3. **Hardcoded Modals and Badges**: `ConnectFolderModal.tsx`, `LiveExecutionBadge.tsx`, `SecretsVaultSettings.tsx`, `ProviderCard.tsx`, `ProviderForm.tsx`, and `KnowledgePage.tsx` had several hardcoded `#171717`, `#181818`, `#121212`, `#0A0A0A` background classes.

### Changes Made
1. **FileTree & Tree Nodes (`FileTree.tsx`, `TreeNodeItem.tsx`, `tree-utils.tsx`)**:
   - Replaced all hardcoded dark backgrounds and hardcoded white text with responsive theme variables (`var(--bg-panel)`, `var(--bg-panel-sub)`, `var(--bg-hover)`, `var(--text-primary)`, `var(--text-muted)`, `var(--text-dim)`, `var(--border-color)`).
   - Updated file icons in `tree-utils.tsx` to use high-contrast theme-friendly accent colors.
2. **Native Electron Title Bar Sync**:
   - Exposed `setTheme` IPC in `apps/desktop/preload.cjs`.
   - Added `theme:set` IPC handler in `apps/desktop/main.cjs` updating `mainWindow.setTitleBarOverlay` dynamically so minimize/maximize/close buttons match light/dark modes.
   - Connected `applyTheme` in `apps/web/src/lib/theme.ts` to call desktop `setTheme` whenever theme changes.
3. **Modals & Settings**:
   - Cleaned up `ConnectFolderModal.tsx`, `LiveExecutionBadge.tsx`, `SecretsVaultSettings.tsx`, `ProviderCard.tsx`, `ProviderForm.tsx`, `ModelProviderSettings.tsx`, and `KnowledgePage.tsx` to use consistent theme variables.

## Files Changed
- `apps/web/src/components/workspace/FileTree.tsx`
- `apps/web/src/components/workspace/TreeNodeItem.tsx`
- `apps/web/src/components/workspace/tree-utils.tsx`
- `apps/web/src/components/workstation/ConnectFolderModal.tsx`
- `apps/web/src/components/workstation/LiveExecutionBadge.tsx`
- `apps/web/src/components/settings/ProviderCard.tsx`
- `apps/web/src/components/settings/ProviderForm.tsx`
- `apps/web/src/components/settings/SecretsVaultSettings.tsx`
- `apps/web/src/components/settings/ModelProviderSettings.tsx`
- `apps/web/src/pages/KnowledgePage.tsx`
- `apps/web/src/lib/theme.ts`
- `apps/desktop/preload.cjs`
- `apps/desktop/main.cjs`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2201 modules transformed)
