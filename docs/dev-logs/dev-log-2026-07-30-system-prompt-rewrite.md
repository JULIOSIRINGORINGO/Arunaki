# Dev Log — System Prompt Rewrite: Digital Employee

**Date & Time:** 2026-07-30
**Author:** AI Agent

## What
Rewrote system prompt files to align with the corrected "Digital Employee" vision. 

Key changes:
1. **identity.md** — reframed from "business AI assistant" to "Digital Employee" with visible interaction on screen, bilingual instruction (respond in user's language), all office file types
2. **rules.md** — merged old rules.md + workspace-rules.md + workspace-flow.md into one focused file. 6 core rules: ACT IMMEDIATELY, NEVER FABRICATE, VISIBLE INTERACTION, READ FIRST, WORK INDEPENDENTLY, VERIFY
3. **verification.md** — simplified checklist (was 30+ lines, now ~10)
4. **memory-context.md** — simplified to 1 paragraph
5. **Deleted** workspace-rules.md and workspace-flow.md (merged into rules.md)
6. **ai.service.ts** — updated system prompt assembly to exclude deleted files

## Files Changed
- `apps/api/src/prompts/identity.md` — rewritten
- `apps/api/src/prompts/rules.md` — rewritten (merged 3 files)
- `apps/api/src/prompts/memory-context.md` — simplified
- `apps/api/src/prompts/verification.md` — simplified
- `apps/api/src/prompts/workspace-rules.md` — deleted
- `apps/api/src/prompts/workspace-flow.md` — deleted
- `apps/api/src/modules/ai/ai.service.ts` — updated assembly
- `docs/dev-logs/dev-log-2026-07-30-system-prompt-rewrite.md` — this file

## Tests
- `npx nest build` ✅ — zero errors

## Notes
- Prompt is now 4 files instead of 6, cleaner and more focused
- All in English, with instruction to respond in user's language
- "Visible Interaction" is now a core rule (Rule #3)
- Next: implement Interaction Service (Playwright browser automation + COM desktop)