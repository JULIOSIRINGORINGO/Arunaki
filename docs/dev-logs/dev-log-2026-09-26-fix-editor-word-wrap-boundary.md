# Dev Log — Fix Editor Word Wrap Boundary & State Toggle

**Date & Time:** 2026-09-26 09:50:00 WIB  
**Author:** AI Agent (Antigravity)

## What
Memperbaiki fitur Word Wrap / Wrap Text pada editor workstation desktop (`apps/web`) agar teks panjang membungkus rapi sesuai batas bidang editor dan tidak lagi melebihi batas atau terpotong:

1. **Fix Default State & StrictMode Double-Toggle Bug (`wordWrap.ts`)**:
   - Menjadikan default Word Wrap bernilai `true` (aktif secara default untuk editor dokumen Arunaki).
   - Memperbaiki fungsi `toggleStoredWordWrap()` agar perubahan status dan penyimpanan `localStorage` dihitung sebelum state setter, menghindari pemanggilan ganda (*double invocation*) dari React StrictMode yang sebelumnya membalikkan state kembali ke `false`.
2. **Fix Flexbox Container Overflow & HTML Wrap Attribute (`CenterEditorView.tsx`, `WorkstationCenterPanel.tsx`)**:
   - Menambahkan atribut HTML `wrap={wordWrap ? "soft" : "off"}` pada `<textarea>` agar engine render teks native browser/Chromium/Electron selalu menghitung ulang pembungkusan kata secara langsung.
   - Menambahkan `min-w-0` dan `w-full` pada `<textarea>` dan kontainer flex parent untuk mencegah flexbox item menggelembung melebihi lebar layar.
   - Menambahkan inline CSS styles: `whiteSpace: wordWrap ? "pre-wrap" : "pre"`, `wordBreak: wordWrap ? "break-word" : "normal"`, `overflowWrap: wordWrap ? "anywhere" : "normal"`, `minWidth: 0`, `width: "100%"`.
   - Mengalibrasi `mirrorRef` agar memiliki `boxSizing: "border-box"` dengan lebar yang sama persis dengan `textareaRef.current.clientWidth`, sehingga pengukuran nomor baris gutter tetap sinkron saat teks panjang terbungkus.

## Files Changed
- `apps/web/src/lib/wordWrap.ts` — Default `true`, perbaikan `toggleStoredWordWrap` anti-regression.
- `apps/web/src/components/layout/TopMenuBar.tsx` — Panggilan langsung `toggleStoredWordWrap()`.
- `apps/web/src/components/workstation/WorkstationCenterPanel.tsx` — Penambahan `min-w-0` pada kontainer flex editor.
- `apps/web/src/components/workstation/tabs/CenterEditorView.tsx` — Penerapan `wrap="soft"`, `min-w-0`, inline styling `pre-wrap`, dan perbaikan batas lebar textarea.

## Tests
- `npm run build -w apps/web`: ✅ 0 errors (built in 27.30s).
