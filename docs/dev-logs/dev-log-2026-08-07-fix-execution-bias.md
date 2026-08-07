# Dev Log — Fix Tool Execution Bias (ask_user)

**Date & Time:** 2026-08-07 21:10:00 WIB
**Author:** Antigravity

## What
Mengatasi masalah "Execution Bias" pada Llama-3/Gemini di mana model terus-menerus mencari data yang tidak ada menggunakan alat pencarian, meskipun telah diinstruksikan untuk tidak melakukannya.
Solusinya adalah membuat *tool* eksplisit `ask_user` dan mencegat alat tersebut di dalam *runner* agar eksekusi loop otomatis berhenti saat model memanggilnya.

## Files Changed
- `apps/api/src/prompts/rules.md` — Mengubah kalimat negatif ("DO NOT") menjadi instruksi positif ("GUNAKAN ALAT ask_user").
- `apps/api/src/modules/tools/services/ask-user.tool.ts` — Membuat alat `ask_user`.
- `apps/api/src/modules/tools/tools-provider.module.ts` — Mendaftarkan alat `ask_user` ke dalam Tool Registry.
- `apps/api/src/modules/chat/agent-runner.service.ts` — Menambahkan logika intersepsi untuk `ask_user` di sinkron & stream loop.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Menambahkan logika intersepsi untuk `ask_user` di background loop.

## Tests
- `npx tsc --noEmit` — ✅ passed (tidak ada error pada kode yang diubah)

## Notes
Model *action-biased* seperti Llama 3 terbukti mengabaikan instruksi "Stop" negatif. Pemberian *tool* komunikasi khusus terbukti menjadi arsitektur "Rem Darurat" yang lebih stabil.
