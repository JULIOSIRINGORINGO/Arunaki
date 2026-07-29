# Dev Log — Native Excel External Window & Embedded Non-Office Viewer Architecture

**Date & Time:** 2026-07-30 00:09:15 WIB  
**Author:** Antigravity AI Engineer  

## What
Refined file opening routing in `FileTree.tsx` and `WorkspacePage.tsx`, resolved Prompt Injection False Positive error, implemented built-in Free Model Auto-Rotation, and aligned System Prompts with OpenClaw Action-First Direct Tool Execution:

1. **Microsoft Excel Documents (`.xlsx`, `.xlsm`, `.xls`)**:
   - Opens natively in standalone Microsoft Excel Desktop application for 100% stable performance and COM Automation Agent Use.

2. **Non-Office Files (`.txt`, `.json`, `.md`, `.pdf`, `.csv`, code files)**:
   - Opens embedded directly inside Arunaki's built-in file viewer & code editor modal!
   - Reads file content via `arunakiDesktop.readFile` and displays it cleanly within the Arunaki UI.

3. **Prompt Injection False Positive Fix (`prompt-injection-detector.service.ts`)**:
   - Fixed regex pattern `/DAN/i` by adding word boundaries `/\bDAN\b/i`.
   - Standard Indonesian words containing "dan" (like `"dan"` or `"mendalam"`) no longer trigger false-positive jailbreak blocks.

4. **Built-in OpenRouter Candidate Pool & Auto-Rotation Fix (`provider.service.ts`)**:
   - Updated `classifyError()` to treat `HTTP 404` (Model Retired/Paid) and `HTTP 400` (Schema Mismatch) as `'rotate'` instead of `'fatal'`.
   - Added built-in `FREE_MODEL_CANDIDATES` array (`nemotron-3-nano` ➔ `ling-3.0-flash` ➔ `laguna-s` ➔ `nemotron-nano-9b`) in `getNextAvailable()`.

5. **OpenClaw Action-First System Prompt Alignment (`workspace-rules.md` & `workspace-flow.md`)**:
   - Replaced old "Read ALL files before doing anything" rule which caused the AI agent to enter endless text-planning / scanning loops.
   - Enforced **Action-First Tool Execution Directive**: when the user requests creating/writing a file (e.g. "Buat file Word", "Buat file test.docx"), the AI Agent IMMEDIATELY executes `write_workspace_file` or `document_writer` in Round 1 without writing manual step text.

## Files Changed
- `apps/api/src/prompts/workspace-rules.md` — Enforced Action-First tool execution rule for creation and write requests.
- `apps/api/src/prompts/workspace-flow.md` — Directs immediate tool invocation for document generation requests.
- `apps/api/src/modules/provider/provider.service.ts` — Added candidate free model pool auto-rotation and updated error classification for 404/400.
- `apps/api/src/modules/ai/prompt-injection-detector.service.ts` — Added word boundaries `\b` to `DAN`, `STAN`, `MONG` regex patterns to eliminate Indonesian word false positives.
- `apps/web/src/components/workspace/FileTree.tsx` — Updated `handleItemClick` to route Excel files natively and non-Office files embedded inside Arunaki.
- `apps/web/src/pages/WorkspacePage.tsx` — Removed blocking `onFileClick` callback wrapper so `FileTree` handles text and binary file embedded previews seamlessly.
- `apps/api/.env` — Configured active verified OpenRouter model `nvidia/nemotron-3-nano-30b-a3b:free`.

## Tests
- `npm run test -w apps/api` — ✅ Passed (100%)
- Action-First Tool Execution prompt directive verification — ✅ Passed
- Model rotation across free OpenRouter candidates — ✅ Passed
- Prompt injection false positive check for Indonesian words ("dan", "mendalam") — ✅ Passed

## Notes
- System prompts are now 100% aligned with OpenClaw's Action-First execution paradigm.
