# Dev Log — 2026-08-05 — Self-Healing Hardening (Gap #11, #12, #13)

## Context
Audit part 2 temuan #11-13: `SelfHealingService` memiliki fallback tool dead-code (nama salah), retry loop tidak adaptif (error tidak di-update), dan deteksi path traversal `.`/`..` bolong.

## Changes

### 1. Fallback Tool Mapping (#11)
- `fallbackMap` kunci diubah dari `workspace_search`/`workspace_read` ke nama tool aktual: `search_workspace`, `read_workspace_file`.
- Tool `workspace_analyze` dihapus (tidak terdaftar).
- Fallback target disesuaikan: `read_workspace_file` fallback ke `list_workspace_files`.

### 2. Adaptive Retry Loop (#12)
- `currentError` di-reassign tiap iterasi dari hasil `retryResult` atau `fallbackResult`.
- Menambahkan `tried` Set (strategy:error) untuk mencegah pengulangan strategi identik pada error yang sama (guard skip).
- Memungkinkan strategi berbeda (misal: `path_correction` lalu `fix_params`) jika error berubah di tengah jalan.

### 3. Path Traversal Hardening (#13)
- `findPaths` sekarang menangkap nilai traversal polos: `.` , `..` , dan `../` yang sebelumnya lolos karena tidak dianggap path (isAbsolute=false dan no separators).
- Menambahkan komentar defense-in-depth di `workspace-tools.service.ts:requirePathInWorkspace`.

## Verification Results

### Automated Tests
- `self-healing.service.spec.ts` baru (7 test):
  - Fallback `read_workspace_file` → `list_workspace_files` sukses.
  - Adaptive retry: ENOENT → `path_correction` → BAD_ARGS → `fix_params` → Success.
  - Guard skip: Strategy identik pada error identik hanya jalan 1x (tidak 3x).
  - Traversal block: `..` dan `../secret.txt` ditolak; absolute path dalam WS diterima.
- Full suite `npm run test` pass (139/139).

### Build
- `npm run build` pass (0 errors).
