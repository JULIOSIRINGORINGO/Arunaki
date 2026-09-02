# Dev Log — Settings Menu 3/3: Desktop Automation & Behavior (real behaviors)

**Date & Time:** 2026-09-02 WIB
**Author:** opencode (AI agent)

## What
Tiga toggle menu "Desktop Automation & Behavior" di Settings yang tadinya
localStorage-only; `auto_open_excel` dan `auto_backup` ternyata dead toggle
(tidak ada consumer di seluruh repo). Sekarang keduanya melakukan aksi nyata
saat task dengan tool selesai di desktop shell.

Usulan awal (simpan ke `/api/global/config`) di-brownkan sendiri: handler
`configUpdate` (handlers/global.ts) memanggil `disposeAllInstancesAndEmitGlobalDisposed()`
pada SETIAP config change → toggle checkbox akan membunuh semua instance. Global
config juga lapisan yang salah untuk prefs runtime shell.

## Files Changed
- `apps/desktop/main.cjs` — IPC baru `fs:backupFolder` (copy native `workspaceRoot`
  → `.arunaki-backups/{ISO-timestamp}/` via `fs.cp` recursive, exclude
  `.arunaki-backups`/`.git`/`node_modules`; tetap dalam batas workspace).
- `apps/desktop/preload.cjs` — expose `backupFolder()` (bridge `arunakiDesktop`).
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` —
  - helper `isDocumentPath` + `DOCUMENT_EXTENSIONS` (xlsx/xls/xlsm/docx/doc/pptx/ppt/csv/pdf);
  - `producedFilesRef` dikumpulkan dari tool `TargetFile`/`path` saat streaming;
  - event `done`: auto-backup (pref default ON, hanya jika ada tool output) +
    auto-open dokumen (pref `=== "true"`) via `openExcelNative` (.xlsx/.xls/.xlsm)
    atau `openPath` (lainnya);
  - degradasi browser → toast info "requires the desktop app".
- `WORKFLOW.md` — Phase 64 checklist.

## Tests
- `npm run build -w apps/web` — ✅ v6.4.3 built.
- `node --check apps/desktop/main.cjs` + `preload.cjs` — ✅ syntax.
- Tidak ada perubahan engine → tidak ada test engine baru.

## Notes
- Bridge `openPath`/`openExcelNative` SUDAH ada di preload (ipakai sekarang).
- Backup berulang menumpuk folder snapshot tanpa rotasi — tambahkan rotasi
  kalau disk menjadi masalah (belum diminta).
- Notifikasi desktop toggle sudah berfungsi sebelumnya (consumer di done handler).