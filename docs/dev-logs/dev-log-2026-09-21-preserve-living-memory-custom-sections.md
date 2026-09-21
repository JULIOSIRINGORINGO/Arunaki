# Dev Log — Fix Living Memory Reset and Preserve Custom Sections Across Turns

**Date & Time:** 2026-09-21 18:15:00 WIB  
**Author:** Antigravity AI  
**Branch:** `feature/messaging-apps-gateway`

## What
Diagnosed and permanently fixed the issue where living memory (`.arunaki/ARUNAKI.md`) had its custom sections (e.g. `PANDUAN RINGKAS`, format examples, tables, user guidelines) stripped and reset back to a generic boilerplate template on every chat turn.

### Root Cause
1. **Destructive Cartography Re-generation (`synthesize`)**:
   - In `packages/engine/engine/src/session/memory.ts`, `onTurnCompleted` calls `cartograph(directory)` after every single turn to refresh the folder file catalog.
   - `cartograph` was calling `synthesize(directory, files, current)`.
   - `synthesize` used a hardcoded template and only extracted bullet points from `## User Preferences & Learned Corrections`. Anything that followed (like custom user guides `## 1. ORDER.TXT`, tables `RINGKASAN CEPAT`, or custom markdown sections) was completely dropped and overwritten with generic boilerplate.
2. **Aggressive Regex in `applyCorrections`**:
   - `applyCorrections` matched `## User Preferences & Learned Corrections[\s\S]*?(?=\n## |\n---|$)`.
   - If trailing custom content did not begin with a strict markdown heading `\n## `, the regex consumed everything up to the end of the file `$`, wiping out custom content during learned rule updates.

### Key Fixes
1. **In-place Catalog Updates (`updateWorkspaceCatalog`)**:
   - Created `updateWorkspaceCatalog(doc: string, files: string[]): string`.
   - In `cartograph()`, if `current` rulebook already exists, it now updates `## Workspace Catalog` in-place, leaving all custom sections, tables, and notes 100% untouched.
2. **Custom Content Extraction in `synthesize`**:
   - Created `extractCustomContent(doc?: string): string` to extract and preserve any trailing custom sections, guides, or tables across synthesize calls.
3. **Safe Section Replacement in `applyCorrections`**:
   - Narrowed regex to only replace `## User Preferences & Learned Corrections` bullets, preserving trailing dividers (`===`), tables, and sections.
4. **Restored File in Workspace**:
   - Restored the full, complete rulebook (including `PANDUAN RINGKAS` and `RINGKASAN CEPAT`) into `E:\REKAPAN\.arunaki\ARUNAKI.md`.

## Files Changed
- `packages/engine/engine/src/session/memory.ts` — Added `updateWorkspaceCatalog`, `extractCustomContent`, in-place catalog updates, and protected regex.
- `packages/engine/engine/test/arunaki/memory.test.ts` — Added 3 tests validating preservation of custom user guides across cartography, synthesize, and applyCorrections.

## Tests Run
- `bun test packages/engine/engine/test/arunaki/memory.test.ts` -> ✅ 10 passed, 0 failed
- `bun test packages/engine/engine/test/messaging/telegram.test.ts` -> ✅ 9 passed, 0 failed
- `npm run build -w apps/web` -> ✅ 0 errors, build successful

## Status
✅ Passed & Verified
