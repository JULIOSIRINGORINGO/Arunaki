# Dev Log — Enforce Native Document Tools & Block Python Inspection

**Date & Time:** 2026-09-26 18:18:00 WIB
**Author:** AI Pair Engineer (Antigravity)

## What
1. **Analisis Log Percakapan Nyata**:
   - Berdasarkan penelusuran log SQLite pada `Arunaki-local.db` (session `ses_f27ccafdaffeDOGKd4MrsV0GSd`, sequence 3585-3610), asisten LLM saat membaca dokumen Word `UKURAN BAJU PENGURUS YAYASAN.docx` ternyata **masih memanggil `bash` dengan perintah inline Python**:
     `python -c "from docx import Document; ..."`
   - Alasan pengguna merasa responnya cepat (`Thought: 1s`) adalah karena eksekusi Python one-liner tersebut cepat di terminal lokal (~200ms), **bukan** karena sudah memakai tool native `word_read`.
2. **Akar Masalah**:
   - Di `packages/engine/core/src/plugin/agent.ts`, instruksi bawaan `BUILD_SYSTEM` lama masih menyebutkan contoh: `"e.g., Python openpyxl scripts to inspect or update spreadsheets"`, dan belum memiliki klausul tegas mengenai ketersediaan tool native `word_read`, `excel_read`, dan `ppt_read`.
   - Tool `bash` (`packages/engine/core/src/tool/bash.ts` dan `packages/engine/engine/src/tool/shell.ts`) tidak memiliki guard eksekusi aktif, sehingga perintah one-liner Python untuk membaca file Office tetap dieksekusi tanpa dicegat.
3. **Solusi & Pengamanan Berlapis**:
   - **Perbarui Prompt Inti (`BUILD_SYSTEM`)**: Memperbarui aturan di `packages/engine/core/src/plugin/agent.ts` dengan klausul eksplisit bahwa pembacaan `.docx`, `.xlsx`, `.xls`, `.csv`, dan `.pptx` **WAJIB** menggunakan native tools (`word_read`, `excel_read`, `ppt_read`) dan dilarang keras membuat script Python/shell.
   - **Execution Guardrail pada Shell**: Menambahkan pencegatan aktif di `packages/engine/core/src/tool/bash.ts` dan `packages/engine/engine/src/tool/shell.ts`. Setiap pemanggilan bash/shell yang mendeteksi pola script Python untuk dokumen Office (`python` + `docx`/`openpyxl`/`pptx`) langsung diblokir dan dikembalikan instruksi wajib untuk menggunakan tool native (`word_read`/`excel_read`/`ppt_read`).

## Files Changed
- `packages/engine/core/src/plugin/agent.ts` — Memperbarui `BUILD_SYSTEM` dengan aturan native tool yang ketat dan menghapus rekomendasi python script lama.
- `packages/engine/core/src/tool/bash.ts` — Menambahkan execution guard untuk memblokir script python office dan memperbaiki deskripsi tool.
- `packages/engine/engine/src/tool/shell.ts` — Menambahkan execution guard serupa pada V1 shell tool.
- `packages/engine/core/test/tool-bash.test.ts` — Menambahkan unit test untuk pencegatan script python dokumen office.

## Tests
- `bun test packages/engine/core/test/tool-bash.test.ts` — ✅ 11 passed, 0 failed
- `bun test packages/engine/core/test/doc-read.test.ts` — ✅ 3 passed, 0 failed
- `bun test packages/engine/core/test/system-context/builtins.test.ts` — ✅ 4 passed, 0 failed
- `npm run build -w apps/web` — ✅ 0 errors, build production sukses

## Notes
Server lokal perlu di-restart (`npm run dev:app`) agar binary backend bun memuat guardrail dan prompt terbaru.
