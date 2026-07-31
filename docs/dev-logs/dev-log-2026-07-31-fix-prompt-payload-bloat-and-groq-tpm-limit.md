# Dev Log — Fix Prompt Payload Bloat & Groq TPM Limit (HTTP 413)

**Date & Time:** 2026-07-31 12:34 WIB
**Author:** Antigravity

## What
Resolved `HTTP 413: Request too large for model llama-3.3-70b-versatile ... tokens per minute (TPM): Limit 12000` error by optimizing workspace context builder payload size.

## Root Cause Analysis
1. In `WorkspaceRunnerService.buildWorkspaceContext()`, the system previously auto-read 2,000 characters from up to 5 top workspace files, appending ~10,000+ characters of raw document previews into the prompt on EVERY request.
2. Combined with system identity prompts, dynamic tool schemas, and conversation history, total prompt tokens exceeded 12,000–15,000 tokens.
3. Groq's free tier for `llama-3.3-70b-versatile` enforces a 12,000 TPM limit. Sending > 12,000 tokens in a single request triggered `HTTP 413 (Payload Too Large)`.
4. The auto-fallback engine attempted to rotate to fallback candidates with the same bloated payload, causing `All providers exhausted after 4 rotations`.

## Fixes Implemented
1. **`WorkspaceRunnerService` (`apps/api/src/modules/workspace/workspace-runner.service.ts`):**
   - Reduced auto-read preview snippets from 2,000 chars x 5 files down to lightweight 250 chars x 3 files.
   - Dropped total context payload from ~15,000 tokens down to < 1,500 tokens.
2. **`ProviderService` (`apps/api/src/modules/provider/provider.service.ts`):**
   - Added HTTP status `413` to `classifyError` rotation rules to ensure proper error handling and rotation.

## Verification
- Clean compilation verified (0 errors).
- Single-request prompt size now well within Groq's 12,000 TPM budget.
