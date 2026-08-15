# Dev Log — Harness Overhaul (OpenCode-Grade Lightweight Architecture)

**Date & Time:** 2026-08-15 10:00:00 WIB
**Author:** Antigravity

## What
Refactored the Arunaki agent harness based on OpenCode's lean architecture. Eliminated token bloat, compressed system prompts by 77%, removed eager file scans, added pagination to file reading, and optimized context compaction. This reduced agent execution time from 166.5s to 7.8s (21x speedup) while retaining 100% accounting and math accuracy.

## Files Changed
- `apps/api/src/prompts/identity.md` — Compressed from 1472 to 380 chars.
- `apps/api/src/prompts/rules.md` — Compressed from 4080 to 1102 chars.
- `apps/api/src/prompts/verification.md` — Compressed from 410 to 152 chars.
- `apps/api/src/prompts/memory-context.md` — Compressed from 244 to 85 chars.
- `apps/api/src/prompts/chat-identity.md` — Compressed from 1737 to 263 chars.
- `apps/api/src/prompts/chat-rules.md` — Compressed from 2579 to 391 chars.
- `apps/api/src/prompts/chat-knowledge-builder.md` — Compressed from 710 to 161 chars.
- `apps/api/src/modules/ai/system-prompt-builder.service.ts` — Streamlined tool listing, temporal context, and memory prompt generation.
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Made workspace context lazy; removed eager directory scanning and file tree dumping.
- `apps/api/src/modules/tools/services/registrars/workspace-file-tools.registrar.ts` — Added `offset` and `limit` to the `read` tool schema.
- `apps/api/src/modules/ai/context-manager.ts` — Updated default context budget to 16,000 with 0.35 compression threshold for small models.

## Tests
- `npx tsc -p tsconfig.build.json` — ✅ 0 errors.
- `npx tsx apps/api/scripts/test-rekap-extended.ts` — ✅ 11/11 checks passed. Execution time: **7.8s** (down from 166.5s).

## Notes
- The agent harness is now lightweight enough for 8B and 70B models to execute without token starvation or context window overflows.
