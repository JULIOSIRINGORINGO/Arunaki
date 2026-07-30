# Dev Log — System Prompt Maturity (Phase 30)

**Date & Time:** 2026-07-30 11:48 WIB
**Author:** AI Agent (Ponytail mode)

## What

Complete restructuring of Arunaki's system prompt to OpenClaw-inspired maturity standards. All prompt files rewritten with concrete, non-ambiguous sections. Dynamic tool list injection replaces hardcoded tables. Self-correction, numerical accuracy, error handling, and output contract sections added to eliminate LLM confusion.

## Files Changed

### Prompt Files (Workspace Mode)
- `apps/api/src/prompts/identity.md` — English, bilingual response rule, operating environment context
- `apps/api/src/prompts/rules.md` — 9 sections, `{TOOL_LIST}` placeholder, self-correction, numerical accuracy, failure protocol
- `apps/api/src/prompts/verification.md` — English checklist

### Prompt Files (Chat Mode)
- `apps/api/src/prompts/chat-identity.md` — aligned persona, chat-appropriate tone
- `apps/api/src/prompts/chat-rules.md` — OpenClaw-style with `{TOOL_LIST}` and `{KNOWLEDGE_BASE}`
- `apps/api/src/prompts/chat-knowledge-builder.md` — concise `/knowledge` workflow

### Code
- `apps/api/src/modules/ai/ai.service.ts` — `ToolRegistryService` injection, `buildToolListSummary()` data-driven from tags, `checkPromptBudget()` token guard, `{TOOL_LIST}` injected in both modes, fixed `rulesWithKB` variable

### Documentation
- `WORKFLOW.md` — Phase 30 added, Current Status updated

## Key Decisions

- **Follow OpenClaw's structure** (Tooling, Tool Call Style, Execution Bias, Safety, Interaction Guide, Error Handling, Output Contract) but adapted for document-only domain
- **Dynamic tool list** over hardcoded table — prevents staleness when tools are added/removed
- **Data-driven categories from tags** — tool registry tags drive category assignment, not hardcoded names
- **Token budget guard** logs warnings — prevents prompt from silently consuming too much context
- **English for system instructions** — most models respond better to English system prompts; bilingual response instruction handles user language

## Tests
- `npx nest build` — ✅ passed (0 errors, 0 warnings)
- Pre-existing test failure in `app.controller.spec.ts` — unrelated (pre-existing `describe is not defined` issue)

## Notes
- Visible interaction section included but tools don't exist yet — fallback clause handles this gracefully
- Memory system injection is next-phase work (importance scoring, citation modes)
- Next: Interaction Service (Playwright + COM automation)