# Dev Log — Reasoning Pruning & Budgeting

**Date & Time:** 2026-08-16 WIB
**Author:** AI Agent (opencode)

## What

Menerapkan 3 lever optimasi kecepatan di Agent Harness untuk memangkas waktu terlama proses agent — reasoning internal LLM (terbukti dari `test-rekap-extended.ts`: ronde final menghabiskan ~270 detik murni reasoning):

1. **Provider parameter** — kirim `reasoning_effort: 'low'` secara dinamis ke semua provider openai-compatible (sebelumnya hanya o1/o3), + `budgetTokens: 1024` untuk Claude thinking.
2. **Steering directive** — injeksi blok `[REASONING EFFORT: LOW]` ke system prompt (chat + workspace), default ON, ada kill-switch env.
3. **Lean Tool Exposure** — sudah ada di kedua mode (workspace `selectToolsForGoal`, chat Tool-RAG); diverifikasi, tidak diubah.

## Files Changed

- `apps/api/src/modules/ai/model-capability.ts` — gpt-oss-20b/120b `reasoningEffort:'low'` + `supportsTools:true`; Claude thinking models; dynamic detection diperluas (gpt-oss, claude-3-7, claude-4).
- `apps/api/src/modules/ai/sdk-transformer.util.ts` — `buildProviderOptions` kirim `openai.reasoningEffort` untuk semua model reasoning openai-compatible; anthropic budget env-configurable (default 1024); `temperature` hanya dikirim bila body memuatnya.
- `apps/api/src/modules/ai/ai.service.ts` — omit `temperature` saat anthropic thinking aktif (thinking force temperature=1, 0.7 akan 400) di jalur `chat()` & `chatStream()`.
- `apps/api/src/modules/ai/system-prompt-builder.service.ts` — `buildReasoningDirective()` di-inject ke stable prefix chat & workspace (ikut cache hash).
- `apps/api/.env.example` — dokumentasi `ARUNAKI_REASONING_EFFORT`, `ANTHROPIC_THINKING_BUDGET_TOKENS`, `ARUNAKI_CONCISE_REASONING`.
- `apps/api/src/modules/ai/sdk-transformer.util.spec.ts` — spec baru (5 test).
- `WORKFLOW.md` — Phase 49 ✅.

## Tests

- `npx vitest run src/modules/ai/sdk-transformer.util.spec.ts` — ✅ 5/5 passed
- `npx vitest run src/modules/ai/{ai.service,stream-chat,system-prompt-cache,sdk-transformer}.spec.ts` — ✅ 14/14 passed
- `npx tsc -p tsconfig.build.json --noEmit` — ✅ 0 errors

## Notes

- Env vars dibaca dinamis per-call (`process.env`), bukan module-load, agar testable + bisa diubah runtime.
- **Pre-existing bug tidak terkait (dilaporkan, tidak difix inline):** `context-manager.spec.ts` `estimateToolResultReduction` expect 14010 vs actual 14160 — komentar test mengasumsikan `toolPreviewChars:250`, konfig default `200`. Dikonfirmasi gagal juga pada checkout bersih (stash). Fix 1 baris bila diinginkan.
- `apps/api/scripts/test-kenari-direct.ts` ada modifikasi lokal (bukan dari perubahan ini) — dibiarkan, tidak di-commit.
- Fleksibilitas: `ARUNAKI_REASONING_EFFORT=off` mematikan SEMUA parameter reasoning + directive; `ARUNAKI_CONCISE_REASONING=false` hanya mematikan directive.
