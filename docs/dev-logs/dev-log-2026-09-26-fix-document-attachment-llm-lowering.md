# Dev Log — Fix Document Attachment Handling for LLM & Auto-Save Workspace

**Date & Time:** 2026-09-26 11:52:00 WIB  
**Author:** AI Agent (Antigravity)

## Problem
Ketika pengguna melampirkan berkas dokumen non-gambar (seperti `.docx`, `.xlsx`, `.pdf`) lalu mengirim prompt ke chat, OpenAI/OpenRouter Chat API mengeluarkan error:
`OpenAI Chat does not support media type application/vnd.openxmlformats-officedocument.wordprocessingml.document`
Hal ini terjadi karena protokol chat completion standar (OpenAI, OpenRouter) hanya menerima MIME gambar (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) pada blok `media` multimodal.

## Solution
1. **Pemisahan Media vs Dokumen Teks pada LLM Lowering**:
   - Pada `packages/engine/core/src/session/runner/to-llm-message.ts`, berkas yang memiliki MIME gambar diteruskan sebagai part `{ type: "media" }`.
   - Berkas dokumen non-gambar (Word, Excel, PDF, dsb.) ditransformasikan secara aman menjadi part teks `{ type: "text", text: "[Attached File: <name> (<mime>)]" }`. Hal ini mencegah API OpenAI melempar error penolakan media type.
2. **Auto-Save Berkas Terlampir ke Workspace Proyek**:
   - Di `ChatInputBox.tsx`, saat pengguna melampirkan berkas, sistem desktop secara otomatis menyimpan berkas tersebut langsung ke folder workspace proyek yang aktif via `window.arunakiDesktop.writeFile`.
   - Event `arunaki-file-tree-refresh` ditembakkan agar daftar berkas di panel penjelajah sisi kiri langsung terbarui secara real-time.
   - Dengan berkas tersimpan di folder proyek, agen Arunaki dapat langsung menggunakan tools pembaca dokumen (`read_file`, `word:openNative`, `parseExcel`, dsb.) untuk mengeksekusi instruksi pengguna.
3. **Dukungan Binary Decode pada IPC Desktop**:
   - Pada `apps/desktop/main.cjs` (`fs:writeFile`), ditambahkan deteksi format data URL Base64 sehingga penulisan berkas biner (DOCX/XLSX/PDF) tersimpan sempurna tanpa korupsi encoding UTF-8.

## Files Changed
- `packages/engine/core/src/session/runner/to-llm-message.ts` — Aman membedakan image MIME vs document attachment saat diterjemahkan ke LLM message.
- `apps/desktop/main.cjs` — Dukungan buffer biner base64 pada `fs:writeFile`.
- `apps/web/src/components/workstation/chat/ChatInputBox.tsx` — Auto-save berkas dokumen ke folder workspace aktif saat dilampirkan.

## Tests
- `npm run build -w apps/web`: ✅ 0 errors (built in 13.46s).
- `bun test packages/engine/core/test/session-runner.test.ts`: ✅ 87 passed, 0 failed.
