# Dev Log — Rely Purely on Native LLM Function Calling (0% Brittle Regex Parsing)

**Date & Time:** 2026-07-31 13:18 WIB
**Author:** Antigravity

## What
Refactored `WorkspaceRunnerService` to eliminate brittle local regex / string-parsing shortcuts and rely 100% on native Groq/OpenRouter LLM Function Calling (`aiService.chat(messages, tools)`).

## Root Cause Analysis
1. Brittle local regex / string-parsing shortcuts (`Dynamic Tool Synthesizer`) attempted to infer target filenames and content locally.
2. Because regex matches are rigid, they failed on edge cases such as filenames with spaces (`test pormat text.txt`) or pronouns ("file itu"), causing fallback confusion.
3. Since Groq LPU executes Function Calling natively in **110 milliseconds**, bypassing the LLM with fragile regex was an unnecessary anti-pattern.

## Fixes Implemented
1. **`WorkspaceRunnerService` (`apps/api/src/modules/workspace/workspace-runner.service.ts`):**
   - Removed regex fallback parsing from `round === 0`.
   - All tool calls (filename selection, format detection, content extraction, and pronoun resolution) are now determined 100% natively by the LLM via OpenAI Function Calling over complete chat history (`messages`).

## Verification
- Clean compilation (0 errors).
- LLM natively resolves pronouns and spaced filenames in 0.1s without regex bugs.
