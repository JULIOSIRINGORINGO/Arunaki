# Dev Log — Contextual Pronoun Resolution & Delete Safety Guard

**Date & Time:** 2026-07-31 13:06 WIB
**Author:** Antigravity

## What
Resolved critical bug where prompt "hapus file itu" deleted an unrelated file (`REKAPAN TERBARU2.txt`) instead of resolving "file itu" to the file generated in the previous assistant turn (`angka_10-20.docx`).

## Root Cause Analysis
1. In `WorkspaceRunnerService` (`workspace-runner.service.ts`), the dynamic action parser extracted the word "itu" as `targetFilename`.
2. Because "itu" did not match any file, fuzzy search in `deleteWorkspaceFile` fell through to listing files in workspace and selected an arbitrary file.
3. Chat history context was not inspected to resolve contextual pronouns ("file itu", "file tersebut", "file ini", "file tadi").

## Fixes Implemented
1. **Pronoun History Resolver (`apps/api/src/modules/workspace/workspace-runner.service.ts`):**
   - Added automatic chat history inspection when user inputs contain pronouns (`itu`, `ini`, `tersebut`, `tadi`, `barusan`, `terakhir`).
   - Scans assistant messages backwards to resolve "file itu" to the exact file created or discussed in the previous turn (`angka_10-20.docx`).
2. **Delete Safety Guard (`apps/api/src/modules/tools/services/workspace-tools.service.ts`):**
   - Added strict guard preventing `deleteWorkspaceFile` from executing if the target name is a pronoun or if the file does not exist on disk or in the DB index.
3. **Core Prompt Rules (`apps/api/src/prompts/rules.md`):**
   - Added Section 10 mandating strict pronoun resolution and forbidding arbitrary file deletion.

## Verification
- Clean compilation (0 errors).
- "hapus file itu" correctly resolves to `angka_10-20.docx` without deleting any unrelated workspace files.
