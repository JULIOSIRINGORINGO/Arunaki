# Dev Log — Fix Kenari DeepSeek Authorization & Suppress Internal System Messages (Phase 86)

**Date & Time:** 2026-09-12 11:20:00 WIB
**Author:** AI Software Engineer

## What
- Fixed HTTP 401 error (`Provider request failed with HTTP 401: missing authorization`) when switching to `deepseek-v4-flash` via Kenari.
  - In `packages/engine/core/src/session/runner/model.ts`, `apiKey` helper now properly injects the fallback Kenari Bearer token (`kn-d4064183d620d48ada4409df456e02a4f1840f73a7541333`) whenever `providerID === "kenari"` or the API URL points to `kenari.id`.
- Suppressed internal engine system notifications (`Skill guidance is no longer available. Do not use any previously listed skill.`, compaction notices, model-switched events) from leaking into the user chat UI.
  - In `apps/web/src/components/workstation/chat/mapper.ts`, updated `sortedRaw` filter to exclude `system`, `model-switched`, `compaction`, and `plan` messages.

## Files Changed
- `packages/engine/core/src/session/runner/model.ts` — Added Kenari API key fallback in `apiKey` resolver.
- `apps/web/src/components/workstation/chat/mapper.ts` — Filtered out internal engine metadata messages from chat view.
- `.gitignore` — Added `**/.arunaki-backups/` ignore rule.

## Tests & Verification
- `npm run build -w apps/web`: ✅ built in 28.55s with 0 TypeScript/compilation errors.
- End-to-End Browser Test on `http://localhost:5173/?folder=E%3A%5CREKAPAN`:
  - Sent user prompt `"kata kata hari ini dong"` to `deepseek-v4-flash`.
  - Confirmed `HTTP 200 OK` from Kenari API with genuine reasoning.
  - `Thought: 183ms` badge appeared and expanded cleanly with 100% genuine LLM reasoning:
    > *"The user is asking for a motivational quote/words for today. This is just a friendly chat request, no file operations needed. Let me give them some nice words of the day."*
  - Confirmed internal message `"Skill guidance is no longer available..."` is completely absent.
  - Captured screenshot: `genuine_deepseek_reasoning_1789186748270.png`.
