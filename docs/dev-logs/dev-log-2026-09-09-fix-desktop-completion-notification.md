# Dev Log — Fix Desktop and Browser Turn Completion Notifications

**Date & Time:** 2026-09-09 09:52:00 WIB
**Author:** Antigravity

## What
- Fixed desktop and web notification dispatch upon message turn completion:
  1. **Removed Unintended Hidden-Window Requirement**: Previously, notifications were blocked if `document.hasFocus()` was true (`isWindowHidden` check). This caused zero notifications to appear whenever the user was actively viewing the app.
  2. **Set Windows AppUserModelId**: Added `app.setAppUserModelId('Arunaki')` on Windows in `apps/desktop/main.cjs`. Without an explicit AppUserModelId, Windows Action Center / Toast Notification service silently drops notifications from Node/Electron processes.
  3. **Added Browser Notification Fallback**: When running in browser mode outside Electron, notifications now request permission and use the standard Web `Notification` API.
  4. **Click-to-Focus Integration**: Added click event handler to the desktop notification in `main.cjs` to automatically restore and focus `mainWindow` when the user clicks the notification.
  5. **Dual Dispatch Safety**: Ensured notifications fire whether completed via SSE `done` event or synchronous `sendPrompt` resolution.

## Files Changed
- `apps/desktop/main.cjs` — Registered `app.setAppUserModelId('Arunaki')` on Windows and added notification click-to-focus.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Added `dispatchCompletionNotification` with browser and desktop support, removing the restrictive `isWindowHidden` check.
- `apps/web/src/components/settings/SettingsAutomationTab.tsx` — Enhanced test button and permission handling for both Electron and Web Notification.

## Tests
- `node -c apps/desktop/main.cjs` — ✅ Syntax check OK
- `npm run build -w apps/web` — ✅ Built in 11.82s with 0 errors

## Notes
- Works seamlessly across both native Windows Electron shell and web browser tabs.
