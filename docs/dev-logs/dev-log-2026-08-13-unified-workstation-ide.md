# Dev Log — Unified Document IDE Workstation Migration

**Date & Time:** 2026-08-13 19:50:00 WIB  
**Author:** Antigravity AI Engineer  

## What
Penggabungan Chat Mode (`/`) dan Workspace Mode (`/workspace`) menjadi 1 Mode Terpadu **Document IDE Workstation** yang persis mengikuti spec wireframe `ui_wireframe_layout_v2.md` (seperti Cursor / Antigravity IDE):
1. **3-Panel Split Workstation**:
   - **Panel Kiri (`EKSPLORE FOLDER`)**: Pohon berkas workspace, filter pencarian file, dan modal buka folder workspace.
   - **Panel Tengah (`MAIN CONTENT / EDITOR`)**: IDE File Reader untuk spreadsheet Excel, dokumen Word, PDF, dan TXT + Antigravity-style **On-Demand Canvas Panel** (dipanggil saat AI chat menghasilkan draf/kalkulasi atau via tombol header `[🎨 Canvas]`, lengkap dengan tombol tutup `✕`).
   - **Panel Kanan (`CHAT AREA & CHAT BOX`)**: Message stream dengan auto-complete `@filename`, live execution badge, dan capsule input box.
   - **Footer Bar (`MAIN MENU KNOWLEDGE`)**: Status bar bawah melengkung yang menampilkan path folder, jumlah file, AI model, dan indikator Knowledge Base active (`garment`).
2. Perbaikan test mock `apps/api/src/modules/ai/tool-call-repair.integration.spec.ts` dan penambahan `todo_write` ke `declaredTools` serta catalog meta-tools `workspace-runner.service.ts`.

## Files Changed
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — [NEW] Komponen utama 1-mode Document IDE Workstation.
- `apps/web/src/App.tsx` — Routing terpadu (`/` dan `/workspace` mengarah ke `UnifiedWorkstationPage`).
- `apps/web/src/components/layout/Sidebar.tsx` — Perbaruan label tab navigasi utama menjadi Workstation IDE.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Penambahan `todo_write` ke core always-available toolset (`selectToolsForGoal`) dan `declaredTools`.
- `apps/api/src/modules/ai/tool-call-repair.integration.spec.ts` — Perbaikan mock response schema Vercel AI SDK.
- `WORKFLOW.md` — Perbaruan checklist Phase 47 ✅ DONE.
- `UX_UI.md` — Dokumentasi filosofi desain 1-mode Document IDE Workstation.

## Tests
- `npx vitest run` in `apps/api` — ✅ **30/30 test files passed (144 unit tests)**.
- `npx tsc -b apps/web/tsconfig.json` — ✅ **0 TypeScript errors**.
- `npm run typecheck` — ✅ **0 errors across backend & frontend workspace**.

## Notes
- Pengguna dapat mengetik pesan secara bebas atau mengunggah/mereferensikan file dengan `@filename`.
- Canvas Panel tidak lagi menutupi layar secara permanen, melainkan dipanggil di Panel Tengah secara *on-demand* dan dapat ditutup kapan saja untuk kembali membaca file IDE.
