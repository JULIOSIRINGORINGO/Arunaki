# Dev Log — Fix Living Memory Persistence Across New Sessions

**Date & Time:** 2026-09-21 12:12:00 WIB  
**Author:** Antigravity AI  

## What
Fixed an issue where living memory (`.arunaki/ARUNAKI.md` / user preferences learned by the Sentinel) appeared to be reset or forgotten whenever a new chat session was started.

### Root Cause Analysis
1. **Runner System Prompt Missing Living Memory (`InstructionContext`)**:
   In `packages/engine/core/src/instruction-context.ts`, the upward directory instruction finder `fs.up()` only targeted `["AGENTS.md"]`. The actual workspace living memory file (`.arunaki/ARUNAKI.md`) was never included in the ambient system prompt. As a result, newly spawned sessions had zero knowledge of existing workspace invariants or Sentinel-learned rules until the user explicitly forced the AI to read `.arunaki/ARUNAKI.md` with a tool call.
2. **Message History Desync in `Session.messages`**:
   The Sentinel background service (`learnCorrection` in `packages/engine/engine/src/session/memory.ts`) relied on `Session.Service.messages({ sessionID, limit: 4 })` to analyze recent user turns. In `packages/engine/engine/src/session/session.ts`, `messages` only read from `MessageTable` (`message`), whereas Arunaki V2 writes messages to `SessionMessageTable` (`session_message`). As a result, `Session.messages` always returned an empty array `[]` for V2 sessions, causing the background Sentinel to silently exit without learning new user rules.
3. **Cartographer Synthesis Extraction Fragility**:
   `extractExistingCorrections()` in `packages/engine/engine/src/session/memory.ts` used a fragile regex expecting strict `### Learned by the Sentinel` sub-header text. Any manual formatting changes could cause it to drop existing rules or include placeholder strings (`_No learned preferences yet._`).

### Key Fixes
1. **`packages/engine/core/src/instruction-context.ts`**:
   - Added `[".arunaki/ARUNAKI.md", "ARUNAKI.md", "AGENTS.md"]` to upward discovery targets.
   - Added deduplication so duplicate root `ARUNAKI.md` is skipped if `.arunaki/ARUNAKI.md` is already discovered in the same folder.
   - Added `join(global.config, "ARUNAKI.md")` to global config paths.
   - Living memory rules are now automatically and permanently injected into `system.baseline` on turn 1 of every session.
2. **`packages/engine/engine/src/session/session.ts`**:
   - Added fallback to `SessionMessageTable` (`session_message`) in `Session.messages()` when `MessageV2.page` returns 0 items.
   - Implemented `mapV2ToWithParts` to transform `session_message` rows into standard `SessionV1.WithParts` (both `user` and `assistant` turns).
3. **`packages/engine/engine/src/session/memory.ts`**:
   - Upgraded `extractExistingCorrections` to extract all bullet items under `## User Preferences & Learned Corrections` regardless of exact sub-header text.
   - Filtered out `_No learned preferences yet._` placeholders so clean states never corrupt real rules.
4. **`packages/engine/core/test/instruction-context.test.ts`**:
   - Added unit test asserting that `.arunaki/ARUNAKI.md` is discovered and its rules are rendered into `SystemContext.initialize().baseline`.
5. **`packages/engine/engine/test/arunaki/memory.test.ts`**:
   - Added test suite for `synthesize` verifying that 100% of existing learned preferences are preserved during cartography re-runs and placeholders are ignored.

## Files Changed
- `packages/engine/core/src/instruction-context.ts` — Added `.arunaki/ARUNAKI.md` & `ARUNAKI.md` to upward search targets and global paths with deduplication.
- `packages/engine/core/test/instruction-context.test.ts` — Updated targets expectation and added unit test for `.arunaki/ARUNAKI.md` loading.
- `packages/engine/engine/src/session/session.ts` — Added fallback to `SessionMessageTable` in `Session.messages()`.
- `packages/engine/engine/src/session/memory.ts` — Robust bullet extraction in `extractExistingCorrections`.
- `packages/engine/engine/test/arunaki/memory.test.ts` — Added synthesize rule preservation tests.
- `WORKFLOW.md` — Updated Phase 105 to ✅ DONE.

## Tests
- `bun test packages/engine/core/test/instruction-context.test.ts`: ✅ 8 pass, 0 fail.
- `bun test packages/engine/engine/test/arunaki/memory.test.ts`: ✅ 9 pass, 0 fail.
- `npm run typecheck`: ✅ passed with 0 errors.
- `npm run build -w apps/web`: ✅ passed with 0 errors (built in 30.57s).
