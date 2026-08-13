# Dev Log — i18n: Translate All Frontend UI Strings to English

**Date & Time:** 2026-08-13 WIB
**Author:** big-pickle

## What
Menerjemahkan semua string Indonesia yang tersisa di frontend (`apps/web/src`) menjadi bahasa Inggris. User request: "semua yang di frontend jadi b inggris aja".

## Files Changed
- `apps/web/src/components/chat/CanvasPanel.tsx` — titles/buttons/empty state
- `apps/web/src/components/chat/LiveExecutionBadge.tsx` — "Executing {tool}..."
- `apps/web/src/components/chat/LiveMirrorCard.tsx` — default title/subtitle, tooltips
- `apps/web/src/components/chat/MessageBubble.tsx` — action chips (Download Excel/PDF, Save to Knowledge) + detection string
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx` — form labels, confirm, status toggle
- `apps/web/src/components/knowledge/KnowledgeToolbar.tsx` — menu items, search placeholder
- `apps/web/src/components/layout/AppLayout.tsx` — nav menu labels & comments
- `apps/web/src/components/settings/ModelProviderSettings.tsx` — toasts, form, confirm
- `apps/web/src/components/settings/SecretsVaultSettings.tsx` — toasts, placeholders, button
- `apps/web/src/components/workspace/FileTree.tsx` — tooltips, modal titles, buttons, placeholders
- `apps/web/src/components/workspace/ScheduledReportsPanel.tsx` — full panel (toasts, modal, labels, options)
- `apps/web/src/components/workspace/TreeNodeItem.tsx` — tooltips (Rename/Delete/Ask AI)
- `apps/web/src/components/workstation/ConnectFolderModal.tsx` — toasts, title, placeholder
- `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx` — tooltips
- `apps/web/src/components/workstation/WorkstationRightChat.tsx` — tooltips, mention popup empty state
- `apps/web/src/pages/HistoryPage.tsx` — mock groups/titles, subtitle, placeholder
- `apps/web/src/pages/KnowledgePage.tsx` — default node titles, loading, upload modal
- `apps/web/src/pages/SettingsPage.tsx` — heading, section text
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — toasts, mock content strings

## Tests
- `npx tsc --noEmit` — ✅ passed
- `npx vite build` — ✅ passed (9.05s, 2198 modules)

## Notes
- Satu `textCenter.svg` di root repo (duplicate dari `apps/web/public/text-center.svg`) tidak ikut di-commit — perlu dihapus jika sudah tidak dipakai.
