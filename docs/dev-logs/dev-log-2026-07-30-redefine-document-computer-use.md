# Dev Log — Redefine as Desktop Document Computer Use Agent

**Date:** 2026-07-30
**Author:** AI Agent

## What
Redefinisi Arunaki setelah klarifikasi dengan user:
- **BUKAN** sandboxed computer use agent dengan shell/script execution
- **BUKAN** coding agent untuk .ts/.py/.js
- **ADALAH** Desktop Computer Use Agent untuk Dokumen — seperti Claude Computer Use / OpenClaw, bisa buka Excel, ketik di cell, format dokumen, tapi semua dalam sandbox workspace

## Files Changed
- `VISION.md` — Corrected: hapus shell/script, tambah computer use untuk dokumen (Excel, Word)
- `docs/BOUNDARIES.md` — Corrected: hapus shell/script, tambah desktop automation, checklist baru
- `PRD.md` — Tool list: shell/script → Excel/Word COM tools; Out of Scope: coding agent explicit
- `docs/AGENT-ARCHITECTURE.md` — Corrected comparison table, tambah "no shell/script by design"
- `AGENTS.md` — Mission: "Desktop Computer Use Agent untuk Dokumen"
- `WORKFLOW.md` — Overview description
- `docs/dev-logs/dev-log-2026-07-30-redefine-sandboxed-computer-use.md` — replaced by this

## Key Clarifications
1. Computer use = visual desktop automation (COM/OLE untuk Excel, Word)
2. Agent seperti manusia: buka app → ketik di cell → format → save
3. BUKAN shell execution, BUKAN script runner, BUKAN coding agent
4. Provider rotation tetap critical — agent akan panggil LLM banyak kali

## Follow-up
- Implement native Excel/Word COM tools (winax sudah mulai)
- Fix provider rotation: `openrouter/free` atau update model pool