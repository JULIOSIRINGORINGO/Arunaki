# Dev Log — Enforce Native Document Tools (Word/Excel/PPT) & Ban Ad-Hoc Pip Installs

**Date & Time:** 2026-09-26 12:07:00 WIB
**Author:** Arunaki AI Agent

## What
Fixed an issue where Arunaki fell back to writing custom Python scripts and executing `pip install python-docx` in the background (causing 1-2 minute delays) when handling Word (.docx) documents. Arunaki already has native, pure-Node.js document readers (`word_read`, `excel_read`, `ppt_read` powered by `jszip` and `xlsx`), but the agent did not prioritize them due to missing instructions in system prompts, vague tool descriptions, bare parameter schemas, and missing workspace path resolution.

## Changes Made
1. **`packages/arunaki-tools/src/word-read.ts`**:
   - Updated tool description to clearly specify native Word document extraction (paragraphs, tables) with zero external dependencies.
   - Added parameter schema annotations (`filePath`).
   - Enabled workspace path resolution via `ctx.extra?.directory` with fallback filename and case-insensitive matching.
2. **`packages/arunaki-tools/src/excel-read.ts` & `ppt-read.ts`**:
   - Same enhancements for Excel and PowerPoint native reading tools.
3. **`packages/engine/engine/src/session/tools.ts`**:
   - Injected `directory: input.session.directory` into `context.extra`.
4. **`packages/engine/engine/src/tool/shell.ts`**:
   - Added runtime guard to block `pip install` / `pip3 install` commands immediately with an instructional error pointing the LLM to native document tools (`word_read`, `excel_read`, `ppt_read`).
5. **`packages/engine/engine/src/session/prompt/default.txt` & `system.ts`**:
   - Documented `word_read`, `excel_read`, and `ppt_read` as the required native tools for `.docx`, `.xlsx`, and `.pptx` documents.
   - Banned package installation commands (`pip install`) and custom script writing for standard document reading.

## Tests Run
- `npm run build -w apps/web`: ✅ Passed (0 TypeScript errors, bundle completed in 15.73s).
- `bun test packages/engine/core/test/session-runner.test.ts`: ✅ 87 passed, 0 failed.
- `git status --porcelain`: Clean after commit.
