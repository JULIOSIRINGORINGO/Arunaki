# Dev Log — Active Workspace Path Synchronization & Clean Status Badge

**Date & Time:** 2026-08-19 17:48:20 WIB
**Author:** Antigravity AI

## What
1. **Workspace Folder Name / Path Display**:
   - Synchronized `UnifiedWorkstationPage` and `AppLayout` so that the active workspace folder (e.g. `laporan-test`) is automatically detected and rendered on the footer left badge instantly upon loading.
2. **Clean Status Badge Styling**:
   - Changed the bottom-right status badge from all-caps (`ARUNAKI ENGINE`) to clean, elegant title-case typography (`Arunaki Engine`).

## Files Changed
- `apps/web/src/pages/UnifiedWorkstationPage.tsx`
- `apps/web/src/components/layout/AppLayout.tsx`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2200 modules transformed)
