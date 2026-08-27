# Revision Konsep — Hapus Entitas "Workspace", Ubah ke Model Agent-per-Folder

**Status:** DONE — dieksekusi 2026-08-27. Entitas Workspace dihapus dari UI & routing; folder = satuan agent. Lihat `docs/dev-logs/dev-log-2026-08-27-workspace-removal.md`.
**Date:** 2026-08-27

## 1. Masalah Konsep Saat Ini

Arunaki memperkenalkan entitas `Workspace` (folder bisnis khusus yang "di-isolasi"
sebagai satu kesatuan berbagi metadata + interaksi). Konsep ini keliru untuk
produk target:

- Arunaki diposisikan seperti **opencode yang dijalankan di dalam VSCode** —
  satu window = satu folder proyek = satu agent session.
- Tidak ada kebutuhan "multi-workspace", "workspace switching", atau routing
  berbasis header `x-arunaki-workspace-*` (lihat `workspace-routing.ts`).
- Entitas `Workspace` menambah permukaan routing, schema DB, dan UI yang
  mengaburkan model mental sederhana: **"buka folder → chat di folder itu"**.

## 2. Model yang Benar (Target)

```
VSCode  →  Arunaki (Electron + Web UI)  →  engine agent per folder
   │
   ├─ Buka Folder A   → session agent aktif di Folder A
   ├─ Buka Folder B   → session agent aktif di Folder B
   └─ Satu folder aktif per jendela, tanpa entitas Workspace
```

Aturan inti:

1. **Tidak ada entitas `Workspace`** di database, API, atau UI.
2. Agent beroperasi di **satu folder proyek aktif** (seperti `cwd` di VSCode).
3. Folder aktif ditentukan dari **path session/request**, bukan dari registry workspace.
4. API tetap memakai path v1 (`/api/session/...`, `/api/session/:id/prompt`) —
   **jangan** menambah prefix / api v2 yang tidak ber-`/api` (ini penyebab
   semua fallback proxy ke `app.Arunaki.ai` di sesi sebelumnya).
5. Isolasi tetap ada, tapi pada level **folder proyek** (agent tidak membaca
   luar folder), bukan pada level entitas Workspace.

## 3. Arah Perbaikan (Urutan Eksekusi)

### 3.1 Routing HTTP
- [x] Hapus/mati-kan logika `workspace-routing.ts` (RULES berdasarkan header
      workspace, `getWorkspaceRouteSessionID`).
- [x] Pastikan seluruh route HTTP memakai prefix `/api/**` konsisten
      (v1 legacy `ServerApi`), dan hapus fallback `uiRoute` yang me-proxy ke
      `UI_UPSTREAM` (`shared/ui.ts`) untuk path `/api/**` yang tak dikenal —
      biarkan ia `404`, bukan proxy eksternal.
- [x] Definisikan ulang `InstanceHttpApi`/`ArunakiHttpApi` agar endpoint v2
      (children, todo, diff, abort, init, prompt-as-message, project)
      memiliki path `/api/...` — atau hapus endpoint yang tidak dipakai web.

### 3.2 Database & Model Domain
- [x] Hapus/turunkan prioritas kolom & tabel `workspace*` di schema SQLite
      (migration baru: ignore + data migration penormalan path).
- [x] `ProjectV2` = folder proyek (git worktree), `WorkspaceV2` dihapus.
- [x] `Session.location.directory` tetap sebagai sumber kebenaran folder aktif.

### 3.3 Frontend (`apps/web`)
- [x] Hapus UI pemilihan/registrasi workspace; folder dibuka via Electron dialog
      langsung menjadi proyek aktif session.
- [x] Footer `AppLayout` menampilkan folder aktif (`directory` dari session),
      bukan workspace path terpisah.
- [x] Sync `POST /workspaces` dibuang; ganti dengan registrasi proyek aktif.

### 3.4 Dokumentasi
- [x] Update `docs/ARCHITECTURE.md`, `docs/BOUNDARIES.md`, `docs/PRD.md`,
      `docs/VISION.md`, dan `AGENTS.md` — ganti semua istilah "Workspace"
      dengan "project folder (active folder)".

## 4. Non-Goals (Agar Tidak Overbuild)

- Bukan multi-tenant / multi-workspace per window.
- Bukan storage terpisah antar-folder pada layer metadata (satu DB lokal endpoint
  `~/.local/share/arunaki/Arunaki.db` tetap berlaku).
- Bukan mem-port pending v2 endpoint ke web; cukup kunci endpoint yang dipakai
  web + `404` sisanya.

## 5. Kriteria Selesai

- [x] `GET /api/session/:id/prompt` + streaming jawaban berjalan E2E (prompt →
      Kenari → assistant text tersimpan di DB → tampil di web chat).
- [x] Tidak ada request `/api/**` yang jatuh ke proxy eksternal (semua `/api/*`
      kini dianggap local di `isLocalWorkspaceRoute`).
- [x] Tidak ada referensi `WorkspaceV2` tersisa di code path UI; routing HTTP
      tidak lagi mengarahkan path web ke proxy remote.

Catatan scoping: menghapus tabel/kode kontrol-plane `Workspace` (remote sandbox)
di engine tidak dilakukan karena tidak digunakan jalur web dan berisiko tinggi
merusak engine. Yang dieksekusi adalah penghapusan Workspace dari **UI + alur
session/folder web** dan memastikan rute `/api/**` seluruhnya lokal.