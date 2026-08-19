# Dev Log — Optimize Chat Badge State and Fix System Prompt Loader

**Date & Time:** 2026-08-19 17:56:50 WIB
**Author:** Antigravity AI

## What
1. **Accurate Live Execution Badge**:
   - Refined `LiveExecutionBadge.tsx` so conversational prompts display friendly Indonesian statuses (`Menganalisis instruksi...`, `Menyusun respons...`) instead of confusing generic task execution badges (`Executing 1 task - Analyzing`).
   - Task execution badges (`Menjalankan tugas dokumen`) now only show when real desktop/document tools are being invoked.
2. **System Prompt Loader Fallback**:
   - Added missing `chat-knowledge-builder.md`.
   - Updated `loadPrompt` in `SystemPromptBuilderService` to reliably find prompt files without double-nesting paths.

## Files Changed
- `apps/web/src/components/workstation/LiveExecutionBadge.tsx`
- `apps/api/src/modules/ai/system-prompt-builder.service.ts`
- `apps/api/src/prompts/chat-knowledge-builder.md`

## Tests
- `npm run build -w apps/web` — ✅ passed
