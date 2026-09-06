# Dev Log — Fix Left Panel Collapse Toggle & Add Ctrl+B Shortcut

**Date & Time:** 2026-09-06 21:00:00 WIB  
**Author:** Antigravity AI Engineer  

## What
Memperbaiki bug di mana panel kiri (Explorer) saat di-collapse tidak bisa dibuka kembali.

### Root Cause
1. Di `apps/web/src/pages/UnifiedWorkstationPage.tsx`, prop `onClose` pada `<WorkstationLeftExplorer />` dipass secara statis sebagai `() => setLeftCollapsed(true)`.
2. Di `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx`, tombol *expand* pada strip collapsed (`PanelLeftOpen`) memanggil `onClose()`.
3. Akibatnya saat panel dalam kondisi collapsed, klik pada tombol expand selalu mengeksekusi `setLeftCollapsed(true)` dan tidak pernah mengubah state kembali menjadi `false`.
4. Selain itu, ikon "Close Folder" pada header explorer sebelumnya sama persis dengan ikon "Close Explorer" (`PanelLeftClose`), membuat UI membingungkan.
5. Resize drag divider tetap muncul saat panel dalam kondisi collapsed.

### Solution
1. Menambahkan prop `onToggle` ke `WorkstationLeftExplorerProps` dan menggunakan `handleToggle = onToggle || onClose` baik saat panel terbuka maupun ter-collapse.
2. Di `UnifiedWorkstationPage.tsx`, meneruskan `onToggle={() => setLeftCollapsed((prev) => !prev)}`.
3. Menambahkan shortcut keyboard global `Ctrl+B` (atau `Cmd+B` di macOS) agar pengguna dapat membuka/menutup panel kiri dengan mudah seperti di VS Code.
4. Memperbaiki ikon "Close Folder" di explorer header agar menggunakan `FolderX` alih-alih duplikat `PanelLeftClose`.
5. Menyembunyikan drag resize handle saat panel kiri / panel kanan sedang ter-collapse.
6. Memungkinkan ikon folder di collapsed strip diklik untuk membuka kembali explorer panel.

## Files Changed
- `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx` — Menambahkan `onToggle`, mengganti tombol expand & close dengan `handleToggle`, memperbaiki ikon `FolderX`.
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — Menambahkan shortcut `Ctrl+B`, menyambungkan `onToggle`, dan menyembunyikan resize bar saat collapsed.

## Tests
- `npm run build -w apps/web` — ✅ Passed (built in 12.98s, 0 TypeScript compile errors).
