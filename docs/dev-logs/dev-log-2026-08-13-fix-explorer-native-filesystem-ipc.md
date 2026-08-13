# Dev Log — Fix: Native Filesystem IPC Wired to Eksplore Panel

**Date & Time:** 2026-08-13 13:50:00 WIB  
**Author:** Antigravity AI Engineer

## What

Perbaikan bug dimana panel Eksplore menampilkan "Belum ada file di workspace ini" meskipun folder yang terhubung berisi file di disk.

## Root Cause Analysis

**Diagnosa menunjukkan 3-layer problem:**

1. **`fs:getFolderTree` IPC handler sudah ada** di `apps/desktop/main.cjs` (line 167) ✅
2. **`getFolderTree` sudah di-expose** di `apps/desktop/preload.cjs` (line 6) via `contextBridge` ✅  
3. **GAP KRITIS**: `WorkstationLeftExplorer.tsx` **tidak pernah memanggil** `arunakiDesktop.getFolderTree()` ❌

Komponen hanya menerima `workspaceFiles` dari API backend (`/api/v1/workspaces/:id/files`) yang berisi file yang **sudah diindeks di database**. Jika folder belum pernah di-initialize/index, array tersebut kosong — meskipun ada banyak file di disk.

## Files Changed

- `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx` — Refactored total:
  - Tambah `useState<NativeNode[]>` untuk menyimpan hasil native tree
  - Tambah `loadNativeTree(rootPath, force?)` yang memanggil `arunakiDesktop.getFolderTree()`
  - Tambah `useEffect` yang reload tree saat `activeWorkspace.rootPath` berubah
  - Tambah loading skeleton (animate-pulse), error state dengan retry button
  - Tambah Refresh button di panel header
  - Fallback ke `workspaceFiles` API jika tidak berjalan di Electron (browser-only mode)
  - Pass `nativeTree` ke `FileTree` component jika tersedia, `files={[]}` jika tidak

- `apps/desktop/main.cjs` — Perbaikan `fs:getFolderTree` handler:
  - Tambah `path.normalize(folderPath)` untuk kompatibilitas Windows backslash paths
  - Tambah `fs.stat()` pre-check untuk verifikasi path ada dan merupakan direktori sebelum scan
  - Tambah `console.log` diagnostik: input path, normalized path, jumlah entries, workspaceRoot
  - Tambah `console.warn` jika `readdir` gagal untuk direktori tertentu
  - Return error payload dengan `{ tree: [], error: string }` jika path tidak valid

## Tests

- `npm run typecheck` — ✅ 0 errors (exit code 0)

## Behavior After Fix

1. Saat workspace dengan `rootPath` terhubung → `loadNativeTree(rootPath)` dipanggil otomatis
2. IPC `fs:getFolderTree` membaca disk langsung via `fs.readdir` (rekursif, max depth 6)
3. Hasil `{ tree: NativeNode[] }` disimpan ke state `nativeTree`
4. `FileTree` menerima `nativeTree` dan merender hierarki file/folder dari disk
5. Pesan "Belum ada file" **hanya** muncul jika scan disk benar-benar mengembalikan array kosong

## Notes

- File yang dimulai dengan `.` (dot files) tetap disembunyikan — ini perilaku VS Code standar
- `node_modules`, `.git`, `dist`, dll. tetap diabaikan via `IGNORED` set
- Refresh button (RotateCw icon) di header panel memicu `loadNativeTree(rootPath, force=true)`
