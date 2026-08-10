# Dev Log — Normalize LLM Prompts & Clean Agent Harness

**Date & Time:** 2026-08-10 11:41:00 WIB
**Author:** Antigravity

## What
1. **Normalized All LLM-Facing Prompts to English**:
   - Cleaned up `@file` pre-read prompt injection in `workspace-runner.service.ts` to use a data-only context block without micromanagement or conflicting instructions.
   - Translated system summary compaction instructions (`LLM_SUMMARY_INSTRUCTIONS`) in `compaction.service.ts` to English.
   - Translated sub-agent prompt templates (`buildSubAgentSystemPrompt`) in `sub-agent-runner.service.ts` to English.
   - Translated all remaining Indonesian parameter descriptions and tool `displayName` metadata in `tools-provider.module.ts`, `workspace-tools.service.ts`, and `knowledge-search.tool.ts` to English.

2. **Harness Simplification**:
   - Aligned Arunaki's context injection with lightweight open-source agent patterns (like `anomalyco/opencode`) to prevent instruction fatigue and attention dilution in LLMs (such as `gpt-oss-120b`).

## Files Changed
- `apps/api/src/modules/workspace/workspace-runner.service.ts`
- `apps/api/src/modules/ai/compaction.service.ts`
- `apps/api/src/modules/chat/sub-agent-runner.service.ts`
- `apps/api/src/modules/tools/tools-provider.module.ts`
- `apps/api/src/modules/tools/services/knowledge-search.tool.ts`
- `apps/api/src/modules/tools/services/workspace-tools.service.ts`
- `docs/dev-logs/dev-log-2026-08-10-normalize-llm-prompts-and-harness.md`

## Tests
- `npm run typecheck` — ✅ passed (EXIT 0)
- `npm test` — ✅ passed (29 test files, 142 tests passed)

## Notes
- Ready to commit and push to main branch on GitHub.
