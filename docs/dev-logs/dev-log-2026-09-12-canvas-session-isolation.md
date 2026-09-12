# Dev Log — Canvas Session Isolation & Automatic Reset on Session Switch

**Date & Time:** 2026-09-12 15:00:00 WIB  
**Author:** AI Software Engineer (Antigravity)

## What
Memperbaiki perilaku daftar Canvas di panel kiri Explorer yang sebelumnya tidak me-reset hitungannya saat berganti session obrolan atau saat membuat obrolan baru (*New Chat*).

Akar Masalah:
- `useTabs.ts` sebelumnya menyimpan `recentCanvases` di `localStorage` dengan kunci global `arunaki_recent_canvases` tanpa mengaitkannya ke `activeChatId`.
- Hal ini menyebabkan riwayat 5 canvas dari obrolan terdahulu tetap melekat dan ditampilkan di semua session obrolan baru maupun lama.

Solusi yang Diterapkan:
1. `apps/web/src/components/workstation/tabs/useTabs.ts`:
   - Menambahkan `activeChatId?: string` ke interface `UseTabsOptions`.
   - Mengubah penyimpanan `recentCanvases` agar tersimpan secara spesifik per session: `arunaki_recent_canvases_${activeChatId}`.
   - Menambahkan efek pemantau pergantian session (`activeChatId`): saat berpindah sesi, `recentCanvases` langsung di-reset ke `[]` (atau memuat hanya canvas milik sesi yang dipilih) dan tab canvas dari sesi sebelumnya di panel tengah otomatis ditutup.
2. `apps/web/src/components/workstation/chat/useWorkstationChat.ts`:
   - Pada `handleNewChat`, memanggil `setRecentCanvases?.([])` agar daftar canvas langsung menjadi 0 secara instan tanpa flicker.
   - Saat memulihkan riwayat sesi lama, canvas hanya diekstrak dari pesan-pesan asisten di dalam sesi obrolan yang sedang aktif tersebut.
3. `apps/web/src/pages/UnifiedWorkstationPage.tsx`:
   - Mengalirkan `activeChatId` dan `setRecentCanvases` dari `useTabs` ke `useWorkstationChat`.

## Files Changed
- `apps/web/src/components/workstation/tabs/useTabs.ts`
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts`
- `apps/web/src/pages/UnifiedWorkstationPage.tsx`
- `WORKFLOW.md`

## Tests
- `npm run build -w apps/web` — ✅ 0 TypeScript errors, bundle berhasil di-generate dalam 21.91s.

## Notes
- Sekarang setiap session obrolan memiliki isolasi kanvas masing-masing. Begitu klik New Chat atau berganti obrolan, kanvas otomatis reset ke 0.
