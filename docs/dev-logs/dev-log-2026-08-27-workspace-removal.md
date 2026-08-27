# Dev Log — Workspace Entity Removal → Agent-per-Folder

**Date & Time:** 2026-08-27
**Author:** OpenCode Agent

## What
Mengeksekusi `docs/REVISION-WORKSPACE-REMOVAL.md` (dulu DRAFT, kini DONE):
hapus entitas `Workspace` dari UI + alur session/folder web, ganti dengan model
**agent-per-folder** (folder aktif = `cwd` di VSCode). Pastikan semua rute
`/api/**` lokal (tidak pernah proxy ke remote), dan folder aktif
(`Session.location.directory` di engine, `arunaki_active_folder` di web) menjadi
satu-satunya sumber kebenaran folder.

## Files Changed
- `packages/engine/opencode/src/server/shared/workspace-routing.ts` — `/api` (semua sub-path), `/session`, `/console` kini lokal.
- `packages/engine/opencode/test/server/workspace-routing.test.ts` — assertion tambahan untuk `/api/*` lokal.
- `packages/engine/opencode/bunfig.toml` — hapus preload `@opentui/solid/preload` yang sudah tidak ada.
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — state `activeFolder` menggantikan daftar `Workspace`; `createSession({directory: activeFolder})`; file via `/api/file`, konten via `/api/file/content`, history via `getMessages()`.
- `apps/web/src/components/layout/AppLayout.tsx` — footer & `Open Folder` memakai `arunaki_active_folder`; tanpa `POST /workspaces`.
- `apps/web/src/components/workstation/ConnectFolderModal.tsx` — jadi pemilih folder (Electron/path), tanpa daftar workspace.
- `apps/web/src/components/workstation/SearchSectionModal.tsx` — `listSessions()` dari engine.
- `apps/web/src/components/workstation/WorkstationLeftExplorer.tsx` — hapus fallback legacy create-file.
- `apps/web/src/components/workstation/WorkstationRightChat.tsx` — paste-image tanpa legacy `/api/files/upload`.
- `apps/web/src/pages/HistoryPage.tsx` — `listSessions()` dari engine.
- `apps/web/src/App.tsx` — hapus route `/workspace/:id`.
- `AGENTS.md`, `docs/VISION.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/BOUNDARIES.md`, `docs/REVISION-WORKSPACE-REMOVAL.md`, `WORKFLOW.md` — terminologi Workspace → project folder (active folder).

## Tests
- `bun test test/server/workspace-routing.test.ts` — ✅ 14 pass (1 fail tak terkait & pre-existing: `Arunaki-gitlab-auth` package missing di `src/plugin/index.ts`)
- `npx tsc --noEmit -p apps/web` — ✅ passed (0 error)
- `npm run build -w apps/web` — ✅ passed (vite build sukses)

## Notes
- Scoping: tabel & kontrol-plane `Workspace` di engine (remote sandbox / `WorkspaceV2`) **tidak** dihapus dari DB karena tidak dipakai jalur web dan berisiko tinggi merusak engine. Yang dieksekusi penuh: penghapusan `Workspace` dari UI, routing, dan alur session/folder web + dokumentasi.
- `SettingsPage` tab "Model Routing & Providers" masih memakai legacy `/api/providers` (fitur custom provider NestJS lama) — tidak disentuh di scope ini, degradasi via catch.
- Pre-existing: error plugin `Arunaki-gitlab-auth` di engine test (bukan bagian perubahan ini).
