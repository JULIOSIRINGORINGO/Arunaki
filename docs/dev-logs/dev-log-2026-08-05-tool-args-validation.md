# Dev Log — Tool Argument Schema Validation Hardening

**Date & Time:** 2026-08-05 10:10 WIB
**Author:** opencode (big-pickle)

## What
Audit `GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md` #5 & #7 lebih dalam. #5 (`model-router` ignore parameter model) **tidak benar** — `getSystemPromptAdditions` memakai parameter lewat `getHints`→`detectFamily`, branch per family (claude/gemini/llama/openai), ter-wire ke prompt workspace & chat (ai.service:569/603/641). #7 (`validateArgs` dianggap tidak ada) **setengah benar** — validasi ada & dipanggil di executeTool:214 & :367, tapi hanya string/number/array/enum/required; `boolean` & `object` lolos tanpa cek.

## Files Changed
- `apps/api/src/modules/tools/tool-registry.service.ts` — `validateArgs` tambah cek `boolean` dan `object` (tolak array). Null optional tetap dianggap absent (skip di loop tipe).
- `apps/api/src/modules/tools/tool-registry.service.spec.ts` — baru: 4 test `validateArgs`.
- `WORKFLOW.md` — Phase 44.9.

## Tests
- `npx vitest run src/modules/tools/tool-registry.service.spec.ts` — ✅ 4 passed.
- `npm run build` (apps/api) — ✅ 0 errors.

## Notes
- #5 tidak diubah — sudah berfungsi penuh; hanya deepseek/qwen/mistral/nemotron yang belum punya branch spesifik (desain, bukan bug).
- `GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md` tidak reliabel untuk #5 & #7 (dibuat dari snapshot lama `Arunaki-main__8_.zip`).
