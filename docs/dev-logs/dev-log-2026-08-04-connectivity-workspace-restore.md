# Dev Log — Desktop ↔ Web ↔ API Connectivity & Workspace Restore UX

**Date & Time:** 2026-08-04 WIB
**Author:** opencode (AI)

## What

Folder connection di Electron desktop app tampak tidak bekerja ("ga ada foldernya") lalu mengarah ke folder yang salah (Rollover QA). Ditelusuri rantai konektivitas Electron ↔ Web UI ↔ API dan ditemukan 3 masalah terpisah, lalu diperbaiki UX-nya agar se-kencang VS Code.

## Files Changed

- `apps/web/src/pages/WorkspacePage.tsx` — fix restore workspace (prefer `arunaki_workspace_id` dari localStorage); tambah `useQuery(["workspaces"])` + `handleReconnectFolder()`; modal "Buka Folder" kini menampilkan daftar **Recent Folders** (klik 1x langsung konek).
- `apps/web/.env` — dibuat baru (untracked, gitignored): `VITE_ARUNAKI_API_KEY` = key dari `apps/api/.env`. Sebelumnya tidak ada → semua request web kena 401 `AuthGuard`.
- `apps/desktop/main.cjs` — (dari commit `4c32bab`) env loader fallback ke `apps/api/.env`.
- `WORKFLOW.md` — tambah Phase 44 (connectivity & restore UX).

## Root Causes

1. **Desktop bridge**: `main.cjs` hanya baca `apps/desktop/.env` (tidak ada) → token kosong → ditolak `ws.close(1008,'Unauthorized')` di `desktop-bridge.service.ts:41-49`. Diperbaiki dengan fallback ke `apps/api/.env`.
2. **Web UI 401**: `apps/web/.env` tidak ada → `VITE_ARUNAKI_API_KEY` undefined → `AuthGuard` global menolak semua request `/api/v1/*`. API & bridge sebenarnya sehat (terverifikasi: WS `OPEN`, `/workspaces` 200 dengan key).
3. **Restore salah folder**: `WorkspacePage.tsx:498` memakai `workspaces.find(ws => ws.rootPath)` (selalu workspace terbaru = Rollover QA) dan mengabaikan localStorage.

## Data

- Dihapus 4 workspace sampah via `DELETE /workspaces/:id` (semua `onDelete: Cascade`): Rollover QA + 3× duplikat laporan-test. List kini `[]`.

## Tests

- `npx tsc -b --noEmit` (apps/web) — ✅ exit 0
- API smoke: GET `/api/v1/workspaces` tanpa key → 401 (expected), dengan key → 200; WS `ws://127.0.0.1:31524?token=...` → OPEN authorized.

## Notes

- **User harus restart Vite + reload/restart Electron** agar `apps/web/.env` ter-bake dan kode restore/Recent Folders aktif (Vite HMR otomatis untuk source change).
- Karena DB dikosongkan, app akan menampilkan modal "Buka Folder" pada launch berikutnya — user pilih folder yang benar (mis. `E:\JS\laporan-test`); folder itu yang akan direstore otomatis selanjutnya.

## Update 2 — VS Code-style alignment (Gap 1-3)

- **Gap 1 (dedupe):** `handleConnectFolder` sekarang cek `workspacesList` dengan path ternormalisasi (case & slash-insensitive); jika folder sudah punya workspace → `handleReconnectFolder` reuse, tidak bikin duplikat.
- **Gap 2 (switch tanpa disconnect):** tombol "Terhubung: {name}" membuka modal "Buka Folder" (Recent Folders + picker) sebagai switcher; tambah tombol "Putuskan Koneksi" di modal.
- **Gap 3 (path + judul):** subtitle header menampilkan path folder aktif; `document.title` = `{folderName} — Arunaki` (window title Electron mengikuti).
- Fix TS: `handleReconnectFolder` + `workspacesList` dipindah sebelum `handleConnectFolder` (TDZ); invalidate `workspaces` query setelah connect baru.

## Tests (update 2)

- `npx tsc -b --noEmit` (apps/web) — ✅ exit 0
