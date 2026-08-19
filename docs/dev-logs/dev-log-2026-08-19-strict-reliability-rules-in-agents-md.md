# Dev Log — Add Strict Workstation Reliability Rules to AGENTS.md

**Date & Time:** 2026-08-19 18:18:10 WIB
**Author:** Antigravity AI

## What
Added strict, non-negotiable rules to `AGENTS.md` to prevent regressions:
1. **React Rules of Hooks**: Absolute ban on placing hooks below conditional returns (prevents blank screen crash on panel collapse).
2. **Chat Stream Lifecycle & Deduplication**: Mandatory message deduplication between optimistic memory state and database query results, banning arbitrary `setTimeout` delays (prevents 2x duplicate message flicker).
3. **Telemetry & Thinking Indicator Standards**: Strict English telemetry; conversational chats show minimal pulsing `Thinking...` while tool cards only appear for actual file tools.
4. **Workspace Sync Integrity**: Immediate database synchronization upon folder selection.
5. **Mandatory Build Verification**: `npm run build -w apps/web` before every commit.

## Files Changed
- `AGENTS.md`

## Tests
- Verification against project guidelines — ✅ passed
