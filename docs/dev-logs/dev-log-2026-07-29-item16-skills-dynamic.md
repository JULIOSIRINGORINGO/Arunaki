# Dev Log — Item 16: Skills Not Dynamic

**Date:** 2026-07-29
**Author:** AI Agent

## What
Added runtime skill loading, LLM-based skill composition, and version history to make skills dynamic.

## Files Changed
- `apps/api/src/modules/skills/skill.service.ts` — Added `loadSkill()`, `loadSkills()`, `composeSkills()`, `mergeSkillContent()`, `getSkillHistory()`, `rollbackSkill()`
- `docs/FIXES-AND-GAPS.md` — Mark Item 16 ✅
- `docs/dev-logs/dev-log-2026-07-29-item16-skills-dynamic.md` — This file

## Tests
- `npx tsc --noEmit` — ✅ passed (only pre-existing test file errors)

## Notes
- `loadSkill/loadSkills()` enable runtime skill loading by name (instead of pre-registration)
- `composeSkills()` uses LLM to intelligently merge multiple skills into a new composite skill
- Version history tracks sourceType and sourceInfo for traceability
- `rollbackSkill()` placeholder ready for future SkillVersion table