# Dev Log — Fix Question Tool Deadlock & Kenari Upstream Timeout

**Date & Time:** 2026-09-14 19:05:00 WIB
**Author:** AI Software Engineer

## What
Investigasi dan perbaikan menyeluruh terhadap keluhan pengguna mengenai "timeout 90s" dan "ga bisa jawab".

Ditemukan dua akar masalah simultan:
1. **Deadlock Question Tool pada V2 Session Runner**:
   - Model LLM memanggil built-in tool `question` saat menghadapi ambiguitas (misalnya konversi rincian reseller 73cm vs baris DTF (RP) pada Excel).
   - Pada `packages/engine/core/src/tool/question.ts` dan `packages/engine/core/src/question.ts`, `QuestionV2.ask()` mengeksekusi `Deferred.await(...)` menunggu jawaban modal interaktif dari pengguna.
   - Karena Arunaki berbasis Web UI / Electron Desktop dan mengikuti filosofi *Minimal Typing, Maximum Automation*, tidak ada komponen modal interaktif dialog pertanyaan di frontend.
   - Akibatnya, fiber eksekusi backend macet selamanya (tergantung), memicu timeout 90 detik di frontend (*Upstream Provider Timeout*), dan memblokade semua pesan berikutnya di antrean inbox (`session_input.promoted_seq = null`).
2. **Upstream Timeout pada Model `nemotron-3-ultra-550b-a55b:free` di Provider Kenari**:
   - Pengujian benchmark langsung ke endpoint `https://kenari.id/v1/chat/completions` menunjukkan bahwa model `nemotron-3-ultra-550b-a55b:free` saat ini tidak merespons sama sekali (timeout >30s tanpa token pertama).
   - Sementara itu, model lain di Kenari seperti `nemotron-3-super-120b-a12b:free` (1.99s), `deepseek-v4-flash` (1.80s), dan `glm-4-7-flash:free` (0.69s) merespons dengan sangat cepat dan normal.

## Files Changed
- `packages/engine/core/src/tool/builtins.ts` — Menonaktifkan `QuestionTool.node` dari daftar default `built-in-tools` agar model tidak memanggil modal tool interaktif.
- `packages/engine/core/src/tool/question.ts` — Menambahkan fail-safe `Effect.timeout("15 seconds")` dan fallback otomatis pilihan pertama jika tool dijalankan.
- `packages/engine/engine/src/tool/registry.ts` — Menonaktifkan `enableQuestionTool` secara default.
- `packages/engine/engine/src/tool/question.ts` — Menambahkan fail-safe timeout 15 detik pada legacy question tool.
- `WORKFLOW.md` — Mendokumentasikan Phase 93.

## Tests & Verification
- `POST /api/session/:sessionID/interrupt` berhasil membebaskan fiber yang sebelumnya terkunci.
- Status sesi aktif diverifikasi: `Active sessions: {}` (idle & siap).
- Benchmark API Kenari:
  - `nemotron-3-super-120b-a12b:free`: 200 OK (1.99s)
  - `deepseek-v4-flash`: 200 OK (1.80s)
  - `glm-4-7-flash:free`: 200 OK (0.69s)
  - `nemotron-3-ultra-550b-a55b:free`: TIMEOUT (>30s)
- `npm run build -w apps/web`: ✅ 0 TypeScript errors.

## Notes
Disarankan pengguna menggunakan model yang aktif dan responsif di Kenari seperti `deepseek-v4-flash` atau `nemotron-3-super-120b-a12b:free` selama `nemotron-3-ultra-550b-a55b:free` masih mengalami overload/outage di sisi upstream Kenari.
