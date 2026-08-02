# Dev Log — Fix Workspace Agent Statelessness (Send History to LLM)

**Date & Time:** 2026-07-31 14:06 WIB
**Author:** OpenCode Agent

## What
Fixed root cause identified in OpenClaw deep-dive: workspace agent was stateless per-request — web UI only sent `{goal}` to `/agent/stream`, not session history. LLM had no context for follow-up turns (e.g., "hapus file itu" could not resolve "itu" to "test pormat text.txt" from previous turn). API controller + runner already accepted `historyMessages` (commit 99fbdfb), but web never sent them.

## Files Changed
- `apps/web/src/pages/WorkspacePage.tsx` — `triggerAutoAnalysis`: collect activeSession messages → `historyMessages`, send in body. Add `sessions, activeSessionId` to useCallback deps.
- `apps/api/src/modules/provider/provider.service.spec.ts` — update stale cooldown assertions (60→20, 600→300) to match commit 99fbdfb changes.
- `apps/api/src/modules/chat/integration-stress.spec.ts` — same stale cooldown fix.

## Tests
- `npx vitest run` (apps/api) — ✅ 45/45 pass (was 6 fail, pre-existing from 99fbdfb cooldown spec update)
- `npx tsc --noEmit` (apps/web) — ✅ 0 errors

## Notes
- `WorkspaceDetailPage.tsx` also uses goal-only body — intentional skip (page has no chat session state; single-shot analysis tool, YAGNI).
- `workspace-runner.service.ts` loop-break after write/delete (`fileWritten` flag) deliberately preserved (committed 99fbdfb as "optimize execution speed"). OpenClaw does not break loop — model gets final answer turn. Trade-off: speed vs natural response. Re-open if user requests.
- Auto-save workspace history memory (runner:1235, `auto-save workspace history memory`) already committed 99fbdfb — partial mitigation even without historyMessages.