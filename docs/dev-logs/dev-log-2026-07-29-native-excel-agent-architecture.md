# Dev Dev Log — Native Excel External Window & Embedded Non-Office Viewer Architecture

**Date & Time:** 2026-07-30 00:10:45 WIB  
**Author:** Antigravity AI Engineer  

## What
Refined file opening routing in `FileTree.tsx` and `WorkspacePage.tsx`, resolved Prompt Injection False Positive error, implemented built-in Free Model Auto-Rotation, and integrated OpenClaw Fallback Text-to-Tool Action Synthesizer:

1. **Microsoft Excel Documents (`.xlsx`, `.xlsm`, `.xls`)**:
   - Opens natively in standalone Microsoft Excel Desktop application for 100% stable performance and COM Automation Agent Use.

2. **Non-Office Files (`.txt`, `.json`, `.md`, `.pdf`, `.csv`, code files)**:
   - Opens embedded directly inside Arunaki's built-in file viewer & code editor modal!
   - Reads file content via `arunakiDesktop.readFile` and displays it cleanly within the Arunaki UI.

3. **Prompt Injection False Positive Fix (`prompt-injection-detector.service.ts`)**:
   - Fixed regex pattern `/DAN/i` by adding word boundaries `/\bDAN\b/i`.

4. **Built-in OpenRouter Candidate Pool & Auto-Rotation Fix (`provider.service.ts`)**:
   - Updated `classifyError()` to treat `HTTP 404` and `HTTP 400` as `'rotate'` instead of `'fatal'`.
   - Added built-in `FREE_MODEL_CANDIDATES` array (`nemotron-3-nano` ➔ `ling-3.0-flash` ➔ `laguna-s` ➔ `nemotron-nano-9b`) in `getNextAvailable()`.

5. **OpenClaw Text-to-Tool Action Synthesizer (`workspace-runner.service.ts` & OpenClaw Issue #5 Fix)**:
   - Investigated OpenClaw codebase (`openclaw/openclaw` issue #5: "Agent returns tool call as plain text instead of invoking tool").
   - Implemented OpenClaw's **Fallback Tool Action Synthesizer**: when free LLM models output text plans (e.g. "1. Buka Word, 2. Simpan file") without structured `tool_calls`, Arunaki automatically parses target filename and content and programmatically executes `write_workspace_file`!

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Integrated OpenClaw Fallback Tool Synthesizer to execute file writes automatically when free LLMs return text plans.
- `apps/api/src/prompts/workspace-rules.md` — Enforced Action-First tool execution rule for creation and write requests.
- `apps/api/src/prompts/workspace-flow.md` — Directs immediate tool invocation for document generation requests.
- `apps/api/src/modules/provider/provider.service.ts` — Added candidate free model pool auto-rotation.
- `apps/api/src/modules/ai/prompt-injection-detector.service.ts` — Fixed DAN regex false positives.

## Tests
- `npm run test -w apps/api` — ✅ Passed (100%)
- OpenClaw Fallback Tool Synthesizer verification — ✅ Passed
- Action-First Tool Execution prompt directive — ✅ Passed

## Notes
- Free LLM models returning plain text plans now reliably trigger real file creation tools in the workspace.
