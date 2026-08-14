# Dev Log — Intelligent Daily Report Date Rollover & Ambiguity Confirmation Rules

**Date & Time:** 2026-08-14 11:27:50 WIB  
**Author:** Antigravity AI Software Engineer  

## What
Refined system prompt guidelines in [`rules.md`](file:///e:/JS/Arunika/apps/api/src/prompts/rules.md) and [`chat-rules.md`](file:///e:/JS/Arunika/apps/api/src/prompts/chat-rules.md) to enforce non-hardcoded, intelligent daily report date rollover behavior:
1. **New Date Rollover Rule**: When advancing a report to a NEW DATE (e.g. 13 AGUSTUS → 14 AGUSTUS), Arunaki's LLM must **REPLACE yesterday's daily sales line items** under `PEMASUKAN` / `PENGELUARAN` with today's new sales entries (instead of appending today's sales onto yesterday's list), while preserving cumulative balances (`NOTE BELUM BAYAR`, `SISA PEMBAYARAN`, `DEPOSIT`).
2. **Ambiguity Confirmation Protocol**: If a user's instruction provides partial data during a date update, Arunaki executes the safest smart rollover and proactively confirms in its reply: *"Saya telah memperbarui laporan ke [Tanggal] dengan data baru ini. Jika Anda ingin menggabungkan dengan transaksi kemarin, silakan beri tahu!"*.

## Files Changed
- `apps/api/src/prompts/rules.md` — Enforced explicit New Date Rollover (Replace vs Append) rule.
- `apps/api/src/prompts/chat-rules.md` — Added Ambiguity Confirmation Protocol for chat mode.

## Tests
- `npm run build` — ✅ Passed (NestJS & Vite built with 0 errors in 7.95s).
- `git commit` & `git push` — ✅ Successfully committed and pushed to `main` (`9395f2b`).

## Notes
- Daily report updates now automatically perform date rollover (replacing previous day's sales with current day's sales) while keeping cumulative notes intact without hardcoded logic.
