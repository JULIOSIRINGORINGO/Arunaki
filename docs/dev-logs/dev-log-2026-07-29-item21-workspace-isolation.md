# Dev Log — Item 21: Workspace Isolation Enforcement

**Date:** 2026-07-29
**Author:** AI Agent

## What
Added workspace path validation in `SelfHealingService.executeWithHealing()` to enforce that tools cannot access files outside the workspace root directory.

## Files Changed
- `apps/api/src/modules/ai/self-healing.service.ts` — Added `validateToolPaths()` method, integrated into `executeWithHealing()`
- `docs/FIXES-AND-GAPS.md` — Mark Item 21 ✅

## Tests
- `npx tsc --noEmit` — ✅ passed (only pre-existing test file errors)

## Notes
- Validates all path-like arguments recursively (keys containing: path, folder, directory, file, location, root, dir, target, source, destination)
- Uses `path.resolve()` to normalize and compare against workspace `rootPath`
- Throws `WORKSPACE_ISOLATION_VIOLATION` error if path is outside workspace
- Called before every tool execution via `SelfHealingService.executeWithHealing()`
- Workspace runner already wraps tool calls with self-healing, so this covers both read-only and mutating tools