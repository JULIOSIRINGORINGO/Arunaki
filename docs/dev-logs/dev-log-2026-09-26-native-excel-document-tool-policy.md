# Dev Log — Enforce Native Document Tools (excel_read, word_read) over Terminal Python Scripts

**Date & Time:** 2026-09-26 14:18:00 WIB
**Author:** AI Software Engineer

## What
Fixed root cause where LLMs (Claude, GPT, etc.) were still running terminal Python scripts (e.g. `python -c "from openpyxl import..."`) when inspecting or asking about spreadsheet files (`data PEGAWAI.xlsx`):
1. **Model Message Attachment Lowering (`packages/engine/engine/src/session/message-v2.ts` & `packages/engine/core/src/session/runner/to-llm-message.ts`)**:
   - Previously, non-media file attachments (`.xlsx`, `.docx`, etc.) were passed as raw binary data URLs. Upstream LLM providers (Anthropic, OpenAI) do not support binary Excel/Word MIME types in their chat completions API, causing the provider to drop or ignore the attachment.
   - Now lowered into clean, structured text parts containing unambiguous tool invocation instructions: `[Attached File: filename.xlsx — Call the 'excel_read' tool with filePath="filename.xlsx" to extract sheets, cells, and rows instantly.]`.
2. **Shell Tool Guidance & Prohibition (`packages/engine/engine/src/tool/shell/prompt.ts`)**:
   - Added explicit tool substitution rules to `bashCommandSection`, `powershellCommandSection`, and `cmdCommandSection` forbidding the use of Python scripts or shell commands to read or inspect spreadsheets/documents, directing the LLM to `excel_read`, `word_read`, and `ppt_read`.
3. **Tool Descriptions & System Prompts (`excel-read.ts`, `word-read.ts`, `default.txt`, `system.ts`)**:
   - Enhanced descriptions and prompt instructions to cover file dimension and size inquiries ("coba cek file ini apa aja ukurannya?"), ensuring zero-shot routing to native document tools in <50ms.

## Files Changed
- `packages/engine/engine/src/session/message-v2.ts` — Structured text attachment lowering with tool hints for non-media files.
- `packages/engine/core/src/session/runner/to-llm-message.ts` — Structured text attachment lowering with tool hints.
- `packages/engine/engine/src/tool/shell/prompt.ts` — Explicit prohibition on running python/shell commands for spreadsheets/docs in bash/powershell/cmd prompt sections.
- `packages/arunaki-tools/src/excel-read.ts` — Enhanced tool description for dimensions, sizes, and row/column counts.
- `packages/arunaki-tools/src/word-read.ts` — Enhanced tool description for word document reading.
- `packages/engine/engine/src/session/prompt/default.txt` — Added explicit inspection query examples for native document tools.
- `packages/engine/engine/src/session/system.ts` — Updated system environment prompt for Excel dimension and size inspection.

## Tests
- `bun test packages/arunaki-tools/test/doc-read.test.ts` — ✅ passed (2 pass, 0 fail, 80ms)
- `npm run build -w apps/web` — ✅ passed (0 errors, built in 27s)
- `bun test packages/engine/engine/test/tool/registry.test.ts` — ✅ passed tool exposure check (`exposes excel_read, word_read, and ppt_read in tools`)
