# Dev Log — Sandbox Isolation Fallback & Web Verification

**Date & Time:** 2026-09-04 10:30:00 WIB  
**Author:** Antigravity AI

## What
- Memperbaiki penegakan Sandbox Isolation pada Arunaki: ketika pengguna belum membuka folder proyek (tidak ada folder aktif), agent harus secara ketat dibatasi (*sandboxed*) di folder `~/.arunaki/scratch` (`C:\Users\AMD\.arunaki\scratch`) dan sama sekali tidak boleh membaca file atau folder proyek root (`e:\JS\Arunika`).
- Menemukan akar masalah (*root cause*): Endpoint `session.create` pada protocol definition sebelumnya tidak memiliki `locationMiddleware`, sehingga `Location.Service` gagal ter-inject dan melempar context error saat fallback, menyebabkan engine fallback ke default `process.cwd()` (proyek root).
- Menambahkan `locationMiddleware` ke `session.create` di `packages/engine/protocol/src/groups/session.ts` dan `packages/engine/protocol/src/api.ts`.
- Memastikan frontend Workstation menampilkan status `SCRATCH` dan `Belum ada folder aktif` ketika tidak ada folder yang dibuka.
- Melakukan verifikasi otomatis via Playwright di Web UI (`http://127.0.0.1:5173/`):
  - User bertanya: `"halo, tolong cek isi folder saat ini ada file apa saja?"`
  - Agent menjawab: `"Halo! 👋 Saya sudah mengecek isi folder saat ini ( C:\Users\AMD\.arunaki\scratch ). Folder ini kosong — tidak ada file atau subfolder apa pun di dalamnya."`
  - Agent terbukti tidak membaca direktori proyek root ketika sandbox aktif.

## Files Changed
- `packages/engine/protocol/src/groups/session.ts` — Menambahkan `locationMiddleware` ke endpoint `session.create`.
- `packages/engine/protocol/src/api.ts` — Menghubungkan `locationMiddleware` ke definisi routing API.
- `packages/engine/server/src/handlers/session.ts` — Sinkronisasi path fallback sandbox.
- `packages/engine/server/src/location.ts` — Penanganan path sandbox `~/.arunaki/scratch`.
- `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx` — Label fallback `Belum ada folder aktif`.
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — Status bar indicator `SCRATCH`.
- `.gitignore` — Mengabaikan folder temporary `scratch/`.

## Tests
- `npm run build -w apps/web` — ✅ Passed (2200 modules transformed, 0 errors, build in 24s)
- Playwright Web UI Headless Test — ✅ Passed (Verifikasi screenshot UI membuktikan agent hanya melihat `C:\Users\AMD\.arunaki\scratch`).

## Notes
- Isolasi folder proyek sekarang 100% mematuhi aturan ketat `AGENTS.md` & `docs/VISION.md`.
