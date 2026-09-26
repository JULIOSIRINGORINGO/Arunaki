# Dev Log — About Arunaki Modal (Desktop Specifications)

**Date & Time:** 2026-09-26 10:35:00 WIB  
**Author:** AI Agent (Antigravity)

## What
Membuat kembali modal **About Arunaki** di menu dropdown **Help** dengan desain, layout, dan hierarki visual 1:1 persis seperti dialog About pada lingkungan IDE desktop (Antigravity/VS Code), tetapi dengan identitas dan runtime teknis asli Arunaki:
1. **Identitas & Branding Arunaki**:
   - Judul: `Arunaki`
   - Versi: `Arunaki Version: 0.1.0 (Phase 109)`
   - Commit SHA: `87e1d5c3bd8c6c46f8425e8527ce4dad460bb787`
   - Tanggal Build: `2026-09-26T10:23:28.000Z`
   - Runtime Elektronik: `Electron 43.2.0`, `Chromium`, `Node.js 24.15.0`, `V8 13.6.233.17-electron.0`, `Windows_NT x64 10.0.26200`.
   - Sandbox: `Active Folder Sandbox`.
2. **Desain Visual & Layout 1:1 (Pure Monochrome)**:
   - Mengikuti tema monokrom khas Arunaki: background `bg-[var(--bg-card)]`, border `border-[var(--border-strong)]`, dan teks kontras tinggi `text-[var(--text-primary)]`.
   - Ikon lingkaran info `(i)` monokrom di sebelah kiri atas.
   - Kolom kanan memuat judul, daftar spesifikasi teknis monospace/sans yang rapi dan dapat diseleksi (`select-text`).
   - Tombol `Copy` berlatar monokrom (`bg-[var(--bg-hover)]`, border `[var(--border-strong)]`, teks `[var(--text-primary)]`) yang menyalin seluruh teks spesifikasi ke clipboard beserta visual feedback (`Copied`).
   - Tombol `OK` berlatar monokrom (`bg-[var(--bg-panel)]`) untuk menutup modal.
   - Tombol `✕` di pojok kanan atas serta penutupan dengan tombol Escape dan klik backdrop.
3. **Integrasi Runtime Desktop**:
   - Menambahkan API `getSystemInfo()` pada `apps/desktop/preload.cjs` agar runtime Electron dapat dideteksi secara dinamis saat dijalankan di aplikasi desktop.

## Files Changed
- `apps/web/src/components/layout/menu/AboutArunakiModal.tsx` — Komponen dialog About Arunaki dengan tema monokrom dan spesifikasi teknis.
- `apps/web/src/components/layout/menu/HelpMenu.tsx` — Menambahkan opsi "About Arunaki" di menu dropdown Help.
- `apps/web/src/components/layout/TopMenuBar.tsx` — State, Escape key handler, dan rendering modal.
- `apps/web/src/components/layout/menu/index.ts` — Export `AboutArunakiModal`.
- `apps/desktop/preload.cjs` — Expose `getSystemInfo` untuk mendeteksi runtime Electron asli.
- `apps/web/src/lib/i18n.ts` — Penambahan string lokalisasi `aboutArunaki` dan `about`.

## Tests
- `npm run build -w apps/web`: ✅ 0 errors (built in 13.54s).
