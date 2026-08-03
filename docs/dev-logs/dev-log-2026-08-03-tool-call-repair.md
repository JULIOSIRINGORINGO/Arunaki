# Dev Log — Tool Call Repair

**Date & Time:** 2026-08-03 15:34:35 WIB
**Author:** OpenCode

## What
Fixed invalid brace structure in text tool-call repair parser. Parser normalizes leaked tool calls from fenced JSON, XML tags, function-call attributes, bare JSON, wrapper objects, multiple calls, trailing commas, and prefixes.

## Files Changed
- `apps/api/src/modules/ai/ai.service.ts` — routes leaked text calls through repair parser.
- `apps/api/src/modules/ai/tool-call-repair.ts` — repairs and normalizes leaked text tool calls.
- `apps/api/src/modules/ai/tool-call-repair.spec.ts` — covers supported text-call formats.

## Tests
- `npx vitest run src/modules/ai/tool-call-repair.spec.ts` — ✅ 10 passed
- `npm test` — ✅ 77 passed
- `npx eslint src/modules/ai/ai.service.ts src/modules/ai/tool-call-repair.ts src/modules/ai/tool-call-repair.spec.ts` — ✅ passed
- `npm run build` — ✅ passed
- `npx tsc --noEmit` — ❌ pre-existing test type errors outside changed files

## Notes
`REKAPAN TERBARU1.txt` remains untracked and excluded from commit.
