# Dev Log — Transition from Coding Agent to Document & Data Agent Persona

**Date & Time:** 2026-09-04 08:45:00 WIB  
**Author:** Antigravity AI

## What
- Mengganti seluruh persona default dari CLI coding / software engineering agent bawaan OpenCode menjadi **Arunaki Desktop Document & Data Agent**.
- Menghapus file backup `default.txt.bak`.
- Memperbarui `packages/engine/engine/src/session/instruction.ts` agar hanya memuat `.arunaki/ARUNAKI.md` (living workspace operating rules) dan tidak lagi memuat `AGENTS.md`, `CLAUDE.md`, atau `CONTEXT.md` internal developer ke dalam prompt sesi pengguna.
- Memperbarui `packages/engine/engine/src/session/system.ts` sehingga semua model standar (Claude, Gemini, GPT-4, Trinity, Ollama, dll.) secara konsisten menggunakan prompt dokumen Arunaki (`PROMPT_DEFAULT`), membuang prompt override coding lama (`PROMPT_ANTHROPIC`, `PROMPT_GEMINI`, `PROMPT_GPT`, `PROMPT_BEAST`, `PROMPT_CODEX`, `PROMPT_TRINITY`).
- Menyesuaikan header prompt pada `kimi.txt` dan `meta.txt` ke ranah dokumen & data.
- Menyelaraskan prompt pendukung subagent (`explore.txt`, `compaction.txt`, `summary.txt`, `title.txt`) dengan contoh-contoh tugas dokumen (rekap excel, invoice, laporan keuangan) alih-alih software engineering / bugfix coding.

## Files Changed
- `packages/engine/engine/src/session/prompt/default.txt` — Mengadopsi prompt dokumen desktop Arunaki dengan few-shot spreadsheet/invoice/rekap, language mirroring, dan aturan persistensi `.arunaki/ARUNAKI.md`.
- `packages/engine/engine/src/session/prompt/default.txt.bak` — Dihapus.
- `packages/engine/engine/src/session/instruction.ts` — Menghapus lookup `AGENTS.md` agar instruksi developer internal tidak bocor ke user chat.
- `packages/engine/engine/src/session/system.ts` — Mengalirkan model umum ke `PROMPT_DEFAULT` dan membersihkan import prompt coding lama.
- `packages/engine/engine/src/session/prompt/kimi.txt` — Header diganti ke dokumen & data.
- `packages/engine/engine/src/session/prompt/meta.txt` — Header diganti ke dokumen & data.
- `packages/engine/engine/src/agent/prompt/explore.txt` — Navigasi file workspace & dokumen.
- `packages/engine/engine/src/agent/prompt/compaction.txt` — Konteks ringkasan untuk asisten agen.
- `packages/engine/engine/src/agent/prompt/summary.txt` — Ringkasan pekerjaan dokumen & data.
- `packages/engine/engine/src/agent/prompt/title.txt` — Contoh judul thread berbasis tugas dokumen dan laporan kantor.

## Tests
- `npm run build -w apps/web` — ✅ Passed (2200 modules transformed, 0 errors, build in 33s)
- `git status --porcelain` — Bersih dan terverifikasi.

## Notes
- Dengan perubahan ini, AI tidak akan lagi menawarkan perbaikan kode, lint/typecheck, unit test, ataupun mencoba mengedit `AGENTS.md` internal saat user meminta bantuan dokumen.
