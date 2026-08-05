# Dev Log — Fix Cross-Tenant Gap (Part 6)

**Date & Time:** 2026-08-05 16:25:00 WIB
**Author:** AI Agent

## What
Fixed cross-tenant data isolation vulnerabilities found in Part 6 of the gap analysis (Issues 24, 25, 26).
- `memory.tool.ts` and `memory.service.ts` now require `workspaceId` and enforce isolation on `search` and `delete` operations.
- `cron.service.ts` now checks for `workspaceId` before performing `deleteSchedule` and `toggleSchedule` operations.
- `skills.tool.ts` now ensures that skills deactivated via `deleteSkill` belong to the calling `workspaceId`.

## Files Changed
- `apps/api/src/modules/tools/tools-provider.module.ts` — Updated tool schemas (`search_memories`, `delete_memory`, `list_memories`, `schedule_cron_job`, `delete_cron_job`, `delete_skill`).
- `apps/api/src/modules/tools/services/memory.tool.ts` — Updated handlers to pass `workspaceId`.
- `apps/api/src/modules/memory/memory.service.ts` — Implemented `workspaceId` enforcement on search and delete.
- `apps/api/src/modules/memory/memory.repository.ts` — Updated `search` query with `workspaceId` filter.
- `apps/api/src/modules/memory/smart-recall.service.ts` — Added `workspaceId` parameter in search call.
- `apps/api/src/modules/cron/cron.service.ts` — Verified `workspaceId` before toggle and delete.
- `apps/api/src/modules/cron/cron.controller.ts` — Passed `x-workspace-id` HTTP header to service operations.
- `apps/api/src/modules/cron/cron.service.spec.ts` — Updated mocks and DI configuration.
- `apps/api/src/modules/tools/services/skills.tool.ts` — Implemented `workspaceId` verification.
- `GAP_ANALYSIS_ARUNAKI_VS_OPENCLAW.md` — Marked items 24, 25, 26 as completed.

## Tests
- `npx tsc --noEmit` — ✅ passed. No TypeScript errors in the touched files. 
- Unit tests (`cron.service.spec.ts`) updated for correct mock behavior.

## Notes
- Tools that are purely mutating without `workspaceId` contextual checks are dangerous. The schema approach here is a stopgap, but it correctly delegates data access control down to the service level (`memory.service`, `cron.service`, `skill.service`).
- We might want to review global data (where `workspaceId = null`) and who has the authority to mutate it in a later phase. Currently, normal workspaces can only read global skills/memories, not delete them.
