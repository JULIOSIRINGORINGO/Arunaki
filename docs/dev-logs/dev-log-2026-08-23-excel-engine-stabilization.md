# Dev Log — Excel Engine Stabilization & Per-Turn Stress Test

**Date:** 2026-08-23
**Author:** ox-alpha

## What
Memperbaiki akar masalah kegagalan stress test Excel multi-sheet dan menstabilkan engine hingga seluruh turn (T1–T6) lolos dengan model `mistral-large:free`.

### Root causes yang ditemukan & diperbaiki (`excel-com.service.ts`)
1. **PS COM binder corruption** — menulis angka via variabel PowerShell setelah ada penulisan string menghasilkan `InvalidCastException` (Int32→String). Fix: nilai numerik ditulis sebagai literal `[double]` inline; delta dihitung lalu dieksekusi via `Invoke-Expression` (binding baru per aksi).
2. **Per-action `sheetName` diabaikan** — batch dengan sheetName per-aksi jatuh ke sheet aktif → data salah sheet. Fix: baris aktivasi `$ws` sebelum tiap aksi.
3. **sheetName tidak valid = silent wrong-sheet write** — fix: throw error berisi daftar sheet tersedia (top-level & per-action).
4. **append_row fleksibel**: menerima `rowData[]`, string CSV, atau object `{Header: value}` (diurutkan otomatis sesuai header row 1).
5. **Sisip di atas baris ringkasan** — bila baris terakhir berlabel teks (mis. "Grand Total"), baris baru disisipkan di atasnya + note di hasil tool agar model menghitung ulang total.
6. **matchColumn fallback** — bila nilai tidak ditemukan di kolom tsb, scan semua cell.
7. **set_format menerima `value:{bold:true}`** (nested object dinormalisasi).
8. **find_cell** (aksi baru) — cari alamat cell berdasarkan teks.
9. **Retry COM 2×** + timeout dinaikkan (registrar 90s) + release COM objects + guard multi-sheet untuk write tanpa sheetName.
10. Metadata `sheets`/`headers`/`activeSheet` dikembalikan di setiap hasil tool.

### Lainnya
- `workspace-tools.service.ts`: normalisasi path backslash dobel dari model (`e:\\dir\\f` → `e:\dir\f`).
- `desktop-tools.registrar.ts`: deskripsi tool dengan RULES 1–4 (sheetName wajib, label-based targeting, delta pair, formula `=SUM` untuk total).
- `excel-stress-test.cjs`: reset fixture idempoten + filter turn per-argumen (`node excel-stress-test.cjs T1,T4`) + logging argumen tool.
- `create-excel.cjs`: generator fixture workbook bersih (3 sheet).
- Model testing: deepseek-v4-flash (kuot habis), agnes-2-5-flash:free (inkonsisten), **mistral-large:free (paling stabil untuk tool-calling)**.

## Files Changed
- `apps/api/src/modules/interaction/excel-com.service.ts`
- `apps/api/src/modules/tools/services/registrars/desktop-tools.registrar.ts`
- `apps/api/src/modules/tools/services/workspace-tools.service.ts`
- `apps/api/test/excel-stress-test.cjs`
- `apps/api/test/create-excel.cjs` (baru)
- `apps/api/test/workspace-demo/.arunaki/ARUNAKI.md` (rulebook workspace demo)

## Tests
- Per-turn (mistral-large:free): T1 5/5 ✅ · T2 3/3 ✅ · T3 ✅ (pair) · T4 9/9 ✅ (dengan T1) · T5 1/1 ✅ · T6 1/1 ✅
- Self-checks: `check-match-write`, `check-batch`, `check-append-note`, `dump-ps` (semua lolos)

## Notes
- `start-local.ps1` = file lokal mesin (skip-worktree), tidak di-commit.
- Sisa risiko: flake COM sesekali ("Command failed" transien) — retry 2× sudah mengurangi; free-model lain tetap kurang konsisten untuk tool-calling.
