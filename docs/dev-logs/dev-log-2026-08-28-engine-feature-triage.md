# Dev Log — Engine Feature Triage (Docs + Decision Shell=KEEP)

**Date & Time:** 2026-08-28 15:00:00 WIB
**Author:** opencode AI

## What
Membuat dokumen triage fitur engine (fork opencode) → daftar status per-item
(KEEP/REMOVE/DEFER/DECIDE) berdasarkan VISION.md & WORKFLOW.md, sebagai dasar
putusan 1/1 untuk penghapusan saat konsolidasi single-harness. Memutuskan
tool `shell` dipertahankan sebagai fallback baca file binary.

## Decision: Shell Tool = KEEP (2026-08-28)
- Alasan: mapping COM (Excel/Word/Ppt) kadang tidak sesuai untuk pembacaan
  binary; shell dipakai sebagai jembatan pengganti.
- Kontrol: tetap melalui gate `Permission` (approval/deny), konteks dibatasi
  ke sandbox folder aktif; helper `od`/`xxd`/`python3`.
- Upgrade path: status bisa turun ke DECIDE lagi jika COM dirasa memadai.

## Files Changed
- `docs/ENGINE-FEATURE-TRIAGE.md` — BARU. Tabel triage tools/service/CLI/build
  + daftar 9 putusan 1/1.
- `docs/MASTER-HARNESS-PLAN.md` — tambah "Catatan Khusus: Tool shell".
- `WORKFLOW.md` — Phase 62.3 (DONE).

## Notes / Open Questions
- Eksekusi REMOVE ditunda ke langkah konsolidasi MASTER-HARNESS-PLAN.
- Putusan 1/1 yang masih terbuka: `code-mode`, `plan`, `mcp`, `command`,
  `background`, CLI utils, `image`/`format`/`share`/`sync`, `tui`, permintaan
  UI/.exe untuk. Lihat dokumen triage.

## Tests
- Hanya perubahan dokumen — tidak ada kode yang diubah.