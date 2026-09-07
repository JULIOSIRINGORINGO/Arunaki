# Dev Log — Fix Windows Python Child Process UTF-8 Encoding

**Date & Time:** 2026-09-07 16:48:00 WIB
**Author:** Antigravity AI Engineer

## What
Discovered and resolved a critical production failure mode on Windows:
By default on Windows, Python subprocesses inherit the system code page (`cp1252`), which causes Python scripts printing or parsing non-ASCII text, emojis (e.g. `✅`, `✨`, `\u2705`), or unicode spreadsheet headers to crash immediately with:
`UnicodeEncodeError: 'charmap' codec can't encode character ...: character maps to <undefined>`.

Injected `PYTHONIOENCODING: "utf-8"` and `PYTHONUTF8: "1"` into the child process environment of `packages/engine/core/src/tool/bash.ts` with `extendEnv: true`. This ensures all Python helper scripts, openpyxl scripts, and terminal utilities executed by the Arunaki engine run in full UTF-8 mode regardless of Windows system locale.

## Files Changed
- `packages/engine/core/src/tool/bash.ts` — Added `PYTHONIOENCODING: "utf-8"` and `PYTHONUTF8: "1"` to child process environment options.
- `docs/dev-logs/dev-log-2026-09-07-fix-windows-python-utf8-encoding.md` — Dev log.

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, production build verified).
- `bun test packages/engine/engine/test/arunaki/memory-e2e.test.ts` — ✅ passed (2 tests passed).
- Standalone Python UTF-8 verification printing unicode characters and emojis — ✅ passed.

## Notes
Ensures seamless execution of Python scripts handling multilingual text, emojis, and currency symbols on any Windows machine.
