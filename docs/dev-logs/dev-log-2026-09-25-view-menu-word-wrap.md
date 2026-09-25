# Dev Log — View Menu Word Wrap Setting

**Date & Time:** 2026-09-25 19:58:30 WIB  
**Author:** AI Agent (Antigravity)

## What
Menambahkan pengaturan **Wrap Text (Word Wrap)** pada dropdown **View Menu** di top menubar workstation, lengkap dengan pintasan keyboard (`Alt + Z`), sinkronisasi status reaktif lintas komponen (`useWordWrap`), dan implementasi visual pada editor dokumen center panel (`CenterEditorView`) serta spreadsheet viewer (`SpreadsheetViewer`).

Fitur utama yang diimplementasikan:
1. **View Menu Setting**:
   - Menambahkan opsi `"Wrap Text"` dengan ikon `WrapText` dari `lucide-react`, shortcut indicator `Alt + Z`, dan checkmark `✓` aktif.
   - Mengikuti estetika dan konvensi antarmuka dropdown `ViewMenu` yang sudah ada.
2. **Editor Document Wrapping & Gutter Alignment (`CenterEditorView`)**:
   - Saat `wordWrap` aktif, teks editor berganti ke `whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto`.
   - Menggunakan off-screen mirror container untuk mengukur tinggi baris yang terbungkus (*line wrap height*) secara presisi sehingga nomor baris pada gutter (`CenterEditorGutter`) tetap sejajar dengan baris teks aktual.
   - Saat `wordWrap` nonaktif, menggunakan mode `whitespace-pre` standar dengan tinggi baris tetap 20px tanpa overhead rendering.
3. **Status Bar Quick Toggle (`CenterStatusBar`)**:
   - Menambahkan tombol indikator status `Wrap` / `No Wrap` di footer status bar editor dokumen dengan tooltip pintasan `Alt + Z`.
4. **Spreadsheet Viewer Compatibility (`SpreadsheetViewer`)**:
   - Sel tabel spreadsheet mendukung pembungkusan teks (*cell wrap*) saat `wordWrap` aktif sehingga isi sel yang panjang tidak terpotong elipsis.
5. **Keyboard Shortcut & Rebinding Registry**:
   - Mendaftarkan ID `toggle-word-wrap` (`Alt + Z`) ke `shortcutsConfig.ts` dan global key listener di `TopMenuBar.tsx`.
   - Otomatis terintegrasi ke modal `Keyboard Shortcuts` untuk kustomisasi pintasan oleh pengguna.
6. **i18n Localization (`i18n.ts`)**:
   - Menambahkan terjemahan bahasa Inggris (`Wrap Text`, `Word Wrap`) dan bahasa Indonesia (`Bungkus Teks (Wrap Text)`).

## Files Changed
- `apps/web/src/lib/wordWrap.ts` — Modul reaktif penyimpanan localStorage & hook `useWordWrap`.
- `apps/web/src/lib/i18n.ts` — Definisi translasi `wrapText` & `wordWrap`.
- `apps/web/src/components/layout/menu/shortcutsConfig.ts` — Registrasi shortcut default `toggle-word-wrap` (`Alt + Z`).
- `apps/web/src/components/layout/TopMenuBar.tsx` — Listener global keyboard shortcut `toggle-word-wrap`.
- `apps/web/src/components/layout/menu/ViewMenu.tsx` — Tombol toggle Wrap Text dengan status checkmark pada dropdown View.
- `apps/web/src/components/workstation/tabs/CenterEditorView.tsx` — Pembungkusan teks dan penyesuaian tinggi nomor baris gutter.
- `apps/web/src/components/workstation/tabs/CenterStatusBar.tsx` — Indikator status `Wrap` / `No Wrap` interaktif di status bar.
- `apps/web/src/components/workstation/canvas/SpreadsheetViewer.tsx` — Dukungan cell wrap saat word wrap aktif.

## Tests
- `npm run build -w apps/web`: ✅ 0 errors, built in 22.90s.
- `bun test packages/engine/engine/test/arunaki/memory.test.ts`: ✅ 11 pass, 0 fail.

## Notes
- Memenuhi aturan React Rules of Hooks (semua hooks dideklarasikan di bagian paling atas komponen tanpa early returns).
- Tidak ada regresi pada chat streaming, folder sync, atau UI badges.
