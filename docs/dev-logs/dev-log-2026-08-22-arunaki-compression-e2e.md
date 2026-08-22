# Dev Log — ARUNAKI.md Auto-Compression E2E & Learned-Rule Guard

**Date & Time:** 2026-08-22 20:25:00 WIB
**Author:** opencode

## What
E2E test of ARUNAKI.md auto-compression via real Arunaki agent flow, which exposed and fixed a critical bug: the compressor LLM could silently drop learned user rules during rewrite.

## E2E Flow (test-arunaki-compression.ts)
1. Bloat ARUNAKI.md with 60 junk duplicate rules (16.6k chars, 302 lines)
2. Send one real correction via `POST /workspaces/:id/agent/stream` (deepseek free)
3. Sentinel learns rule → patches → fires `compressWorkspaceRules()` automatically
4. Compressor LLM rewrites file → guard restores any dropped learned rules
5. Result: **5/5 assertions pass** (16.634 → 9.787 chars, junk pruned 60→0, structure intact, learned rule survived)

## Bug Found & Fixed
**Symptom:** First E2E run — compression succeeded but the just-learned rule vanished; section replaced with "All learned corrections have been incorporated... pending."
**Root cause:** `compressWorkspaceRules()` had no validation that learned rules survive the LLM rewrite. Weak models treat single rules as trivial and summarize them away.
**Fix:** Post-rewrite guard in Cartographer — extracts all `- [Auto-Learned ...]` lines from original content, detects missing ones in compressed output (60-char prefix match), re-inserts them under "User Preferences & Learned Corrections" before writing.

## Debug Findings Along the Way
- Old test scripts hardcode workspace IDs that no longer exist in DB (`cmsy49l9l...` → 404). Test now uses fresh ID registered via `POST /workspaces`.
- Inline `node -e` from PowerShell double-escapes backslashes in JSON bodies (rootPath stored as `E:\\JS\\...`). Fixed by using script files with `String.raw`.
- Cartographer background regeneration runs during agent turns when workspace mtimes change — it rewrote ARUNAKI.md mid-test, wiping the seeded junk rules before compression fired (not a bug per se, but explains first-run numbers).

## Files Changed
- `apps/api/src/modules/workspace/services/workspace-cartographer.service.ts` — learned-rule restore guard in `compressWorkspaceRules()`
- `apps/api/scripts/test-arunaki-compression.ts` — **NEW** E2E harness (SSE stream client with visible error events)

## Tests
- `npx nest build` — 0 errors
- `npx vitest run src/modules/workspace/` — 20/20 passed
- `node --experimental-strip-types scripts/test-arunaki-compression.ts` — **5/5 passed**

## Notes
- Compression is conservative by design: merges duplicates/prunes contradictions, keeps section structure (safer than naive "shrink to N chars").
- Follow-up risk: deepseek free sometimes paraphrases the user directive at learning time (first run lost "cuaca" specificity). That's model quality at the Sentinel extraction step, not architecture.
