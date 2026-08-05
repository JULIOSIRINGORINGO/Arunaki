# Dev Log — Fix Cross-Tenant Gap (Part 7, #27)

**Date & Time:** 2026-08-05 16:43:00 WIB
**Author:** AI Agent

## What
Fixed cross-tenant data isolation vulnerabilities for `create_skill` and `update_skill` tools as identified in Part 7 (Issue #27).
- `create_skill` now correctly scopes skills to the active workspace by making `workspaceId` a required parameter in the schema and injecting it directly into `skillService.createSkill()`. This prevents all newly created skills from defaulting to the global scope.
- `update_skill` now explicitly validates ownership of the skill being updated. If a skill belongs to another workspace (or is global, in normal user flows), it returns a `FORBIDDEN` error instead of blindly overwriting the content.

## Files Changed
- `apps/api/src/modules/tools/tools-provider.module.ts` — Updated `create_skill` and `update_skill` schemas to include `workspaceId` as a required parameter.
- `apps/api/src/modules/tools/services/skills.tool.ts` — Updated `createSkill` and `updateSkill` handlers to accept `workspaceId`, properly passing it downstream and enforcing cross-workspace restrictions on updates.
- `GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md` — Marked finding 27 criteria as completed.

## Tests
- `npx tsc --noEmit` — ✅ passed. Type contracts between the `tools-provider` and `skills.tool` are verified and safe.

## Notes
- Issue #28 regarding `ContextQuarantine` for `browser_get_content` and other web data is intentionally deferred, to be implemented alongside Part 1 #4 (context-engine unification).
