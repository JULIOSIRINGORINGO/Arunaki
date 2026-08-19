# Dev Log — Interactive Desktop Automation Settings & Account Profile UI

**Date & Time:** 2026-08-19 17:30:30 WIB
**Author:** Antigravity AI

## What
Transformed the passive "Desktop Integrations" tab into a fully functional **Desktop Automation & OS Behavior** settings panel with 3 connected features, and enhanced the **Account & License** tab with customizable user profile photo/name and Social OAuth (Google & GitHub) UI.

### Key Changes:
1. **Desktop Automation & Behavior Toggles**:
   - **Otomatis Buka Excel Saat Mulai Mengedit (Toggle ON/OFF)**: Controls whether the native Microsoft Excel window launches on the desktop as soon as the agent begins processing a spreadsheet.
   - **Auto-Backup Dokumen Sebelum Dimodifikasi (Toggle ON/OFF)**: Integrated automated timestamped `.bak` creation inside `.arunaki/backups/` in `edit-tool.service.ts` before modifying any file.
   - **Notifikasi Panel Windows (Toggle ON/OFF)**: Connected Electron's native `Notification` API (`app:notify` in `main.cjs` and `preload.cjs`) with a direct test trigger button.
2. **Account & License Tab Enhancements**:
   - Added User Profile Photo/Avatar upload & preview with camera overlay.
   - Added Full Name / Business Name input and persistence.
   - Added modern OAuth login buttons for **Google** and **GitHub**.

## Files Changed
- `apps/desktop/main.cjs`
- `apps/desktop/preload.cjs`
- `apps/api/src/modules/tools/services/edit-tool.service.ts`
- `apps/web/src/pages/SettingsPage.tsx`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2200 modules transformed)
