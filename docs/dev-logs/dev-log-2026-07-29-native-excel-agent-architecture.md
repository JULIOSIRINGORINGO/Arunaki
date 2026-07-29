# Dev Log — Native Excel External Window & Embedded Non-Office Viewer Architecture

**Date & Time:** 2026-07-30 00:17:10 WIB  
**Author:** Antigravity AI Engineer  

## What
Refined file opening routing, resolved Prompt Injection False Positive error, implemented built-in Free Model Auto-Rotation, and fixed Critical User Goal Ingestion Bug in Workspace Agent Runner:

1. **Microsoft Excel Documents (`.xlsx`, `.xlsm`, `.xls`)**:
   - Opens natively in standalone Microsoft Excel Desktop application for 100% stable performance and COM Automation Agent Use.

2. **Non-Office Files (`.txt`, `.json`, `.md`, `.pdf`, `.csv`, code files)**:
   - Opens embedded directly inside Arunaki's built-in file viewer & code editor modal!

3. **Prompt Injection False Positive Fix (`prompt-injection-detector.service.ts`)**:
   - Fixed regex pattern `/DAN/i` by adding word boundaries `/\bDAN\b/i`.

4. **Built-in OpenRouter Candidate Pool & Auto-Rotation Fix (`provider.service.ts`)**:
   - Updated `classifyError()` to treat `HTTP 404` and `HTTP 400` as `'rotate'` instead of `'fatal'`.
   - Added built-in `FREE_MODEL_CANDIDATES` array (`nemotron-3-nano` ➔ `ling-3.0-flash` ➔ `laguna-s` ➔ `nemotron-nano-9b`).

5. **CRITICAL ROOT CAUSE BUG FIX: User Goal Ingestion Bug (`workspace-runner.service.ts`)**:
   - Identified exact bug why AI Agent got stuck writing text plans without calling tools: `safeGoal` (the user's prompt, e.g. `"Buat file test1.docx"`) was NEVER pushed into the `messages` array passed to `this.aiService.chat(messages, tools)`.
   - Because `messages` lacked the user's prompt, the LLM received only system prompt + past history without the new request, resulting in 0 tool calls.
   - Appended `messages.push({ role: 'user', content: safeGoal })`. The LLM now receives the user prompt and IMMEDIATELY invokes `write_workspace_file` or `document_writer`!

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Pushed safeGoal to messages array so LLM receives the user prompt and executes tool calls directly.
- `apps/api/src/prompts/workspace-rules.md` — Enforced Action-First tool execution rule.
- `apps/api/src/prompts/workspace-flow.md` — Directs immediate tool invocation.
- `apps/api/src/modules/provider/provider.service.ts` — Added candidate free model pool auto-rotation.
- `apps/api/src/modules/ai/prompt-injection-detector.service.ts` — Fixed DAN regex false positives.

## Tests
- `npm run test -w apps/api` — ✅ Passed (100%)
- User Goal message injection verification — ✅ Passed
- Action-First Tool Execution prompt directive — ✅ Passed

## Notes
- The AI Agent now receives the user's command directly in the chat payload and executes tool calls immediately in Round 1.
