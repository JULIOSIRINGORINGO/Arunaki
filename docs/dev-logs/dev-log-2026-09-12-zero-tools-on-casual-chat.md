# Dev Log — Enforce Zero-Tools on Casual Greeting & Chat

**Date & Time:** 2026-09-12 14:20:00 WIB  
**Author:** AI Software Engineer (Antigravity)

## What
Mengatasi akar masalah perilaku agent yang selalu memanggil tool (seperti `read .` / exploring directory) bahkan pada sapaan sederhana seperti `"halo"`. Solusi dilakukan dengan menerapkan perlindungan deterministik ganda:
1. **Deterministic Classifier (`packages/engine/core/src/session/runner/casual.ts` & `packages/engine/engine/src/session/query-classifier.ts`)**: Mendeteksi secara akurat sapaan santai (`halo`, `hai`, `selamat pagi`, `apa kabar`, dsb) tanpa salah mengklasifikasikan tugas dokumen riil (`rekap ke excel`, pembacaan file, catatan transaksi numerik, atau input multi-baris).
2. **Programmatic Zero-Tools Enforcement (`packages/engine/core/src/session/runner/llm.ts`)**: Pada giliran awal (`currentStep <= 1`) jika query terdeteksi kasual:
   - Pengambilan tools dari registry dilewati (`toolMaterialization = undefined`).
   - Properti `tools` yang dikirim ke LLM dikosongkan secara mutlak (`tools: []`).
   - Properti `toolChoice` diset tegas ke `"none"`.
   Hal ini menjamin secara matematis model LLM tidak dapat memanggil tool apa pun pada sapaan santai.
3. **Prompt & System Context Hardening**:
   - Menambahkan Rule 7 (*Casual Chat & Greetings - Zero-Tools Rule*) pada `BUILD_SYSTEM` di `packages/engine/core/src/plugin/agent.ts`.
   - Memperbarui `default.txt` dan `system.ts` di `packages/engine/engine`.

## Files Changed
- `packages/engine/core/src/session/runner/casual.ts` — Modul klasifikasi teks kasual.
- `packages/engine/core/src/session/runner/llm.ts` — Penegakan programmatic `tools: []` & `toolChoice: "none"`.
- `packages/engine/core/src/plugin/agent.ts` — Penambahan aturan kasual pada `BUILD_SYSTEM`.
- `packages/engine/core/test/session-casual.test.ts` — Unit test untuk deteksi kasual core runner.
- `packages/engine/engine/src/session/query-classifier.ts` — Modul query classifier prompt loop.
- `packages/engine/engine/src/session/prompt.ts` — Integrasi perlindungan query classifier.
- `packages/engine/engine/src/session/prompt/default.txt` — Panduan sapaan santai pada template prompt.
- `packages/engine/engine/src/session/system.ts` — Klarifikasi non-intervensi file saat obrolan santai.
- `packages/engine/engine/test/session/query-classifier.test.ts` — Unit test untuk query classifier.
- `WORKFLOW.md` — Pencatatan fase 88 sebagai selesai (✅).

## Tests
- `bun test packages/engine/core/test/session-casual.test.ts packages/engine/engine/test/session/query-classifier.test.ts` — ✅ 12 passed, 0 failed (93 assertions).
- `npm run build -w apps/web` — ✅ 0 errors, tuntas dalam 28.45s.
- `browser_subagent` E2E test pada `http://localhost:5173/?folder=E%3A%5CREKAPAN`:
  - Input `"halo"`: Model membalas ramah tanpa mengeksekusi tool apapun (0 document task cards). Bukti: `halo_chat_completed_1789197369424.png`.
  - Input `"baca file Kata-Kata Hari Ini.txt"`: Model mengeksekusi tool `read` dan menampilkan konten file dengan tepat. Bukti: `read_file_result_1789197445909.png`.

## Notes
- Tidak ada regresi pada operasi dokumen riil.
- Pengalaman percakapan kasual kini instan, bersih, dan sesuai standar Antigravity/Cursor.
