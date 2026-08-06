# Dev Log — Dynamic Folder Panel Header Title (VS Code Explorer Style)

**Date & Time:** 2026-08-06 10:05:48 WIB  
**Author:** AI Software Engineer  

## What
Updated the right side file tree panel header title to render dynamically:

1. **Dynamic Workspace Name**: Instead of hardcoded "Folder", the header title now displays the actual connected folder name (e.g. `laporan-test`) matching VS Code Explorer behavior.
2. **Fallback Handled**: If no folder is connected, gracefully displays `"Workspace"`.

## Files Changed
- `apps/web/src/components/workspace/FileTree.tsx` — updated header title to `{workspaceName || "Workspace"}`

## Tests
- `npx tsc -b --noEmit` (apps/web) — ✅ passed (0 errors)
- `npm run build` (full monorepo) — ✅ passed (0 errors)
