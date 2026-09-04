# Dev Log — Fix Scratch Path Leak in Workspace

**Date & Time:** 2026-09-04 13:05:00 WIB
**Author:** AI Agent (Antigravity)

## What
Fixed an issue where the internal `~/.arunaki/scratch` sandbox path was leaking into the LLM prompt. While `system.ts` correctly handled `isScratch` to avoid injecting `Working directory`, the system context in `packages/engine/core/src/system-context/builtins.ts` was unconditionally injecting the working directory path into the LLM context. Added an `isScratch` check inside `builtins.ts` to replace the path with a friendly "Workspace status: No project folder opened (unconnected scratchpad)" message when the user has not connected a workspace.

## Files Changed
- `packages/engine/core/src/system-context/builtins.ts` — Added `isScratch` check for environment system context injection.
- `packages/engine/engine/src/tool/shell.ts` — Added `scratch-guard` interception to `ShellTool` execution to prevent path leaks from CLI tools (like `dir` or `ls`).
- `packages/engine/engine/src/tool/scratch-guard.ts` — Added console logging to track guard execution.

## Tests
- `run UI test (Playwright)` — ✅ passed. Agent no longer hallucinates the `C:\Users\AMD\.arunaki\scratch` path and responds correctly that it is an empty workspace (scratchpad).
- Engine starts and responds cleanly without leaking the path.

## Notes
- The LLM responds gracefully and instructs the user how to get started (e.g. "Membuka folder proyek yang sudah ada", "Membuat file baru").
- The UI properly retains its `No folder opened` empty state.
