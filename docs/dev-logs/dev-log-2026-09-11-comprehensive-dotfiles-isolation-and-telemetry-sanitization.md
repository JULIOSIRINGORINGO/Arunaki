# Dev Log — Comprehensive Dot-Files Isolation, Tool Telemetry Sanitization & Conversational Guardrails

**Date & Time:** 2026-09-11 19:15:00 WIB  
**Author:** AI Software Engineer (Antigravity)

## What
1. **Core & Engine Strict Dot-Files Exclusion**:
   - `packages/engine/core/src/tool/read-filesystem.ts`: Menambahkan filter `.filter((item) => !item.name.startsWith("."))` pada `ReadTool.list` sehingga hasil pembacaan struktur direktori tidak pernah menyertakan folder/file tersembunyi.
   - `packages/engine/core/src/filesystem.ts`: Mengubah filter `item.name.startsWith(".arunaki")` menjadi `item.name.startsWith(".")` pada `FileSystem.list`.
   - `packages/engine/core/src/tool/glob.ts` & `grep.ts`: Memfilter hasil pencarian agar seluruh entri berkas yang mengandung segmen tersembunyi yang diawali titik dieliminasi sebelum diserahkan ke model LLM.
   - `packages/engine/engine/src/session/memory.ts`: Memperbarui `isSkipped` agar mengabaikan segmen berkas yang diawali titik (`seg.startsWith(".")`) pada proses sintesis rulebook cartographer serta pembuatan snapshot backup awal.
2. **Hard Guardrail & Shell Output Sanitization**:
   - `packages/engine/engine/src/tool/external-directory.ts`: Memperketat pengecekan guardrail tool sehingga akses terhadap target berkas/folder internal (`.arunaki`, `.arunaki-backups`, `.git`, `arunaki.json`) langsung ditolak dengan `Access denied`.
   - `packages/engine/engine/src/tool/shell.ts`: Membersihkan keluaran baris perintah shell (`dir /b`, `ls`, dll.) dari baris-baris berkas/folder tersembunyi (`.arunaki`, `.arunaki-backups`, `.git`, `.gitignore`, `ARUNAKI.md`) sebelum dikirimkan ke konteks LLM.
3. **Conversational Greetings & Prompt Sanitization**:
   - `packages/engine/engine/src/session/system.ts`: Menambahkan instruksi ketat `CONVERSATIONAL GREETINGS & CASUAL CHAT (STRICT)` agar model tidak mengeksekusi tool baca berkas atau listing direktori saat menerima sapaan santai (`"halo"`, `"selamat pagi"`, dll.).
   - `packages/engine/engine/src/session/prompt/default.txt`: Menghapus instruksi bagi LLM untuk memanggil tool `read`/`edit` pada `.arunaki/ARUNAKI.md` (karena aturan Living Memory dikelola secara otonom oleh background Sentinel), serta melarang pemanggilan tool pada sapaan percakapan biasa.
4. **UI Telemetry & Execution Badge Sanitization**:
   - `apps/web/src/components/workstation/LiveExecutionBadge.tsx`: Menyaring `formatFriendlyToolLabel` agar target berkas tersembunyi atau berkas internal tidak pernah dipaparkan ke antarmuka pengguna sebagai `Explored ARUNAKI.md`.
   - `apps/web/src/components/workstation/chat/mapper.ts`: Menambahkan `isInternalToolPart` untuk mengecualikan langkah-langkah tool internal (seperti inspeksi rulebook atau dotfiles) dari collapsible execution card, sehingga percakapan biasa tidak memunculkan card eksekusi (sesuai aturan ketat AGENTS.md rule 3).

## Files Changed
- `packages/engine/core/src/tool/read-filesystem.ts` — Filter dot-files in directory listing
- `packages/engine/core/src/filesystem.ts` — Exclude dot-files in FileSystem.list
- `packages/engine/core/src/tool/glob.ts` — Exclude dot-paths from glob results
- `packages/engine/core/src/tool/grep.ts` — Exclude dot-paths from grep results
- `packages/engine/core/test/tool-read-filesystem.test.ts` — Added unit test for dotfile exclusion
- `packages/engine/engine/src/session/memory.ts` — Skip dot-files in cartographer and snapshot backup
- `packages/engine/engine/src/tool/external-directory.ts` — Hard guardrail against internal metadata directories
- `packages/engine/engine/src/tool/shell.ts` — Sanitize shell output to suppress dot-files
- `packages/engine/engine/src/session/system.ts` — Conversational greetings policy and strict dot-files prompt
- `packages/engine/engine/src/session/prompt/default.txt` — Remove tool execution instructions on internal ARUNAKI.md
- `apps/web/src/components/workstation/LiveExecutionBadge.tsx` — Sanitize tool label display
- `apps/web/src/components/workstation/chat/mapper.ts` — Filter internal tool parts from UI execution steps
- `WORKFLOW.md` — Phase 81 documentation marked DONE

## Tests
- `bun test packages/engine/core/test/tool-read-filesystem.test.ts` — ✅ passed (8/8 tests pass)
- `npm run build -w apps/web` — ✅ passed (0 errors)

## Notes
Semua titik kebocoran berkas titik (`.`) baik pada level core engine, tool shell, memory cartographer, system prompt, hingga tampilan UI badge telah ditutup rapat. Percakapan santai seperti `"halo"` kini tidak lagi memicu tool call atau collapsible execution card yang membocorkan berkas internal.
