# Dev Log — Autonomous LLM Tool Discipline (Eliminating Heuristic Parsers)

**Date & Time:** 2026-09-12 14:35:00 WIB  
**Author:** AI Software Engineer (Antigravity)

## What
Sesuai arahan dan prinsip arsitektur agent otonom (Computer Use / OpenClaw / Antigravity), sistem tidak menggunakan parser regex atau heuristic code interceptor untuk menentukan pemanggilan tool. Keputusan untuk memanggil tool atau merespons dengan teks murni sepenuhnya diserahkan kepada kognisi LLM (`toolChoice: undefined` / `auto`).

Perbaikan dilakukan murni pada kognisi model melalui:
1. **Pembersihan Parser**:
   - Menghapus seluruh file detektor regex/parser (`casual.ts`, `query-classifier.ts`).
   - Mengembalikan `packages/engine/core/src/session/runner/llm.ts` dan `packages/engine/engine/src/session/prompt.ts` agar selalu menyajikan `tools` lengkap ke LLM tanpa pencegatan kaku.
2. **Penyempurnaan `BUILD_SYSTEM`**:
   - Menata ulang hierarki instruksi pada `BUILD_SYSTEM` di `packages/engine/core/src/plugin/agent.ts`.
   - Mengklarifikasi bahwa sapaan santai, pertanyaan identitas, atau obrolan umum cukup direspons dengan teks murni.
   - Menegaskan bahwa prinsip "Action-First & Autonomous Minimal Typing" berlaku saat ada permintaan dokumen/spreadsheet atau data transaksi yang diberikan pengguna.
3. **Scoping Deskripsi Tool**:
   - Memperjelas deskripsi tool `read` di `packages/engine/core/src/tool/read.ts` agar model memahami tool ini hanya dipanggil untuk operasi file dokumen dan bukan untuk sapaan santai.

## Files Changed
- `packages/engine/core/src/plugin/agent.ts` — Penyempurnaan `BUILD_SYSTEM` kognisi tool vs sapaan.
- `packages/engine/core/src/session/runner/llm.ts` — Pemulihan tool pass-through murni ke LLM.
- `packages/engine/core/src/tool/read.ts` — Penyempurnaan deskripsi tool `read`.
- `packages/engine/engine/src/session/prompt.ts` — Pembersihan import lama.
- `WORKFLOW.md` — Pembaruan catatan fase 88.
- `docs/dev-logs/dev-log-2026-09-12-zero-tools-on-casual-chat.md` — Dev log.

## Tests
- `npm run build -w apps/web` — ✅ 0 errors, tuntas dalam 28.18s.
- `Invoke-RestMethod http://127.0.0.1:4096/api/health` — ✅ healthy: True.

## Notes
- Arsitektur kini 100% selaras dengan prinsip AI Agent otonom: kognisi internal LLM yang menentukan interaksi tool tanpa dibatasi oleh parser buatan.
