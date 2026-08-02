# Dev Log — Fix Pronoun Resolution Regex for Spaced Filenames

**Date & Time:** 2026-07-31 13:10 WIB
**Author:** Antigravity

## What
Resolved bug where "hapus file itu" failed to resolve filenames containing spaces (such as `test pormat text.txt`).

## Root Cause Analysis
1. In `WorkspaceRunnerService` (`workspace-runner.service.ts`), the regex used `\w\-` to match filenames, which stopped at spaces (`[a-zA-Z0-9_]`).
2. When the user created `test pormat text.txt` and typed "hapus file itu", the parser failed to extract the spaced filename and fell back to listing workspace files.

## Fixes Implemented
1. **`WorkspaceRunnerService` (`apps/api/src/modules/workspace/workspace-runner.service.ts`):**
   - Upgraded pronoun history regex to a multi-stage matcher:
     1. Bold tags: `\*\*([^*]+)\*\*` (matches `**test pormat text.txt**`)
     2. Quotes: `["']?([^"'\n]+\.[a-zA-Z0-9]+)["']?`
     3. Spaced extensions: `([\w\s\-.]+\.(?:docx|doc|xlsx|xls|pdf|txt|md|csv|json))`

## Verification
- Scratch test script verified extraction of `test pormat text.txt` from previous turn content.
- Clean compilation (0 errors).
