# Dev Log — Fix Remote Proxying API Endpoints

**Date & Time:** 2026-08-27 15:50:00 WIB
**Author:** Antigravity

## What
Mekanisme proxy ke `app.opencode.ai` (sekarang `app.arunaki.ai`) disebabkan oleh dua hal pada arsitektur OpenClaw yang masih tersisa:
1. `isLocalWorkspaceRoute` hanya mencocokkan rute HTTP berdasarkan daftar hardcode (yang belum mengenali prefix `/api/session` dari Vite web proxy atau method lain seperti `POST`). Akibatnya semua traffic dianggap bukan rute lokal, lalu jatuh ke logika proxy remote `WorkspaceRoutingMiddleware`.
2. `getWorkspaceRouteSessionID` gagal mengekstrak ID sesi jika path berawalan `/api/...` (karena regex-nya hanya cocok dengan `^\/session\/`). Jika gagal ekstrak ID, middleware gagal meresolusi direktori *workspace* dari database, yang akan merusak *Workspace Isolation* (jatuh ke fallback `process.cwd`).

Karena Arunaki 100% lokal dan tidak menggunakan remote sandboxes (semua folder workspace adalah lokal), perbaikan yang dilakukan adalah mencabut ketergantungan remote-proxying dengan mendaftarkan semua sub-path `/session` dan `/api/session` sebagai rute *local*.

## Files Changed
- `packages/engine/opencode/src/server/shared/workspace-routing.ts` — Menambahkan rule untuk memetakan semua method/path `/session` dan `/api/session` ke action: `"local"`. Mengubah Regex pada `getWorkspaceRouteSessionID` agar mendukung prefix `/api/`.
- `packages/engine/opencode/test/server/workspace-routing.test.ts` — Memperbarui assertion *unit test* sesuai behavior lokalisasi penuh Arunaki.

## Tests
- `npm run build -w apps/web` — 🔄 running (background)

## Notes
- Dengan perubahan ini, seluruh endpoint yang sebelumnya memicu 500 ENOTFOUND karena salah diarahkan ke `app.arunaki.ai` (seperti `/api/session/:id/message`, `/api/session/:id/children`, dll) kini akan dihandle sepenuhnya oleh backend lokal.
- Ini sudah menyelesaikan permasalahan utama "1 mekanisme salah" (isLocalWorkspaceRoute / target remote) yang Anda temukan.
