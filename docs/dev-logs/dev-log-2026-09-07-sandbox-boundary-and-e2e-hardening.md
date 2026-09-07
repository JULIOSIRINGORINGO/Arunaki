# Dev Log — Sandbox Boundary Guardrail & Multi-Feature E2E Hardening

**Date & Time:** 2026-09-07 15:52:00 WIB  
**Author:** AI Software Engineer (Antigravity)  

## What
1. **Diagnosis & Perbaikan Sandbox Boundary Leak**:
   - Selama uji E2E pembatasan folder (`C:\Windows\win.ini` dan `D:\`), ditemukan bahwa permission `external_directory` default bernilai `"ask"`, yang menyebabkan sesi menggantung (hang) karena web UI tidak memiliki modal/dialog approval permission.
   - Selain itu, tool `bash` sebelumnya hanya mencetak *advisory warning* ketika perintah mereferensikan direktori di luar workspace (`cmd /c dir D:\`), sehingga model dapat lolos (bypass) mengeksekusi perintah shell ke drive luar.
   - Memperbaiki `packages/engine/core/src/plugin/agent.ts` dan `packages/engine/engine/src/agent/agent.ts` agar permission `external_directory`, `doom_loop`, dan `.env` default bernilai `"deny"`.
   - Memperbaiki `packages/engine/core/src/tool/bash.ts` agar menegakkan `permission.assert({ action: "external_directory", ... })` pada semua path eksternal yang terdeteksi di argumen perintah shell.
   - Menambahkan Rule 5 (Absolute Workspace Boundary) ke `BUILD_SYSTEM` persona agen agar agen secara proaktif dan santun menolak permintaan di luar folder aktif.
2. **Pembersihan Artefak Direktori Windows**:
   - Menambahkan pembersihan otomatis untuk folder artefak `-p` atau `--parents` yang tidak sengaja terbuat oleh `mkdir -p` di lingkungan Windows shell.
3. **Uji Multi-Feature E2E Komprehensif**:
   - Menguji 6 kapabilitas utama Arunaki:
     1. Boundary Guardrail Enforcement (Rejection & 0 byte leak)
     2. Multi-turn Document Update & Recalculation (BAJU 360 -> 380, TOTAL 440 -> 460)
     3. Preservasi formula native Excel (`=SUM(H30,H31)` tidak ditimpa hardcoded)
     4. Multi-turn Context Retention (Append baris verifikasi catatan)
     5. Natural Language Query & Cross-referencing Lintas Dokumen
     6. Pembuatan Dokumen Baru (`LAPORAN_7_SEPTEMBER.csv`)
     7. Isolasi Scratch (`.arunaki/scratch/` terisolasi dan auto-cleanup)

## Files Changed
- `packages/engine/core/src/plugin/agent.ts` — deny `external_directory` & `doom_loop`, Rule 5 di `BUILD_SYSTEM`.
- `packages/engine/core/src/tool/bash.ts` — assert `external_directory` permission pada argumen shell.
- `packages/engine/engine/src/agent/agent.ts` — deny `external_directory` & `doom_loop` pada konfigurasi engine default.
- `packages/engine/engine/src/arunaki/memory.ts` — sanitasi direktori `-p`, update `SKIP_DIRS`, refresh cartography di turn completed.
- `WORKFLOW.md` — dokumentasi Phase 70.

## Tests & Verification
- `bun test packages/engine/engine/test/arunaki/memory-e2e.test.ts` — ✅ Passed (2 pass, 0 fail).
- `npm run build -w apps/web` — ✅ Passed (0 error, build in 10.48s).
- Microsoft Excel COM Native Validation (`validate-excel.ps1`):
  - Row 31 (BAJU RP) = 380
  - Row 29 (BELANJA LABURA) = 460 (formula auto-recalculated)
  - `STATUS: PERFECT_OPEN`
- E2E Test Suite Scripts:
  - `test-guardrail-e2e.mjs` — ✅ PASSED
  - `test-csv-creation-e2e.mjs` — ✅ PASSED
  - `test-feature-suite-e2e.mjs` — ✅ PASSED

## Status
✅ Complete & Clean.
