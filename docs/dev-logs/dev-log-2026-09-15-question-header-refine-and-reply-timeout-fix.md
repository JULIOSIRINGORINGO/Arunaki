# Dev Log — Question Header Refinement & Reply Timeout Resolution

**Date & Time:** 2026-09-15 12:26:00 WIB  
**Author:** AI Software Engineer

## What
1. **Question Prompt Card Header Refinement**:
   - Removed `uppercase tracking-wider` so the card title uses natural casing (`text-transform: none`).
   - Added automatic Title-Casing fallback for raw all-caps input from LLMs (`formatHeader`).
   - Styled header typography to `text-xs font-semibold text-[var(--text-primary)]`.
   - Replaced hollow outline icon with a circular solid white badge (`bg-white rounded-full`) containing a black symbol inside (`text-black font-black` `?` for unanswered state, Lucide `Check` with `stroke-[3.5]` for answered state).
2. **Resolved Question Reply Timeout Bug**:
   - When the user selected an option from the QuestionPromptCard, the frontend sent the reply using the LLM's tool call ID (e.g. `call_748f5dc8...`), while the server endpoint `/api/session/:sessionID/question/:requestID/reply` expected the schema-validated `que_...` QuestionID. This caused the backend to fail matching the pending deferred promise, leading to a 60-second `TimeoutError`.
   - Enhanced `replySessionQuestion` in `apps/web/src/lib/engine.ts` to automatically resolve the active `que_...` ID from pending session questions (`fetchSessionQuestions`) when an arbitrary ID or tool call ID is supplied.
   - Added `case "question.asked"` in `mapEngineEvent` to capture the real `que_...` QuestionID immediately from engine SSE events.
   - Updated `withOwnedQuestion` in `packages/engine/server/src/handlers/question.ts` to match by either `request.id === requestID` or `request.tool?.callID === requestID`, and pass the real `request.id` to `question.reply`.
   - Corrected timeout error tag in `packages/engine/core/src/tool/question.ts` and `packages/engine/engine/src/tool/question.ts` to `"TimeoutError"`.
   - Fixed typecast in `packages/engine/core/src/session/runner/model.ts`.

## Files Changed
- `apps/web/src/components/workstation/chat/QuestionPromptCard.tsx` — Non-uppercase bold header + solid white circular badge with black symbol
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Handle question reply and optimistic state updates with ID format resilience
- `apps/web/src/lib/engine.ts` — Handle `question.asked` SSE event and auto-resolve `que_` ID in `replySessionQuestion`
- `packages/engine/server/src/handlers/question.ts` — Match pending question by either `request.id` or `request.tool?.callID`
- `packages/engine/core/src/tool/question.ts` — Catch `TimeoutError`
- `packages/engine/engine/src/tool/question.ts` — Catch `TimeoutError`
- `packages/engine/core/src/session/runner/model.ts` — Fix sanitized requestedID typecast

## Tests
- `npm run build -w apps/web` — ✅ Passed (0 compilation errors, Vite production build succeeded)
- `npm run typecheck -w @arunaki/server` — ✅ Passed (`tsgo --noEmit` exited with code 0)
- Puppeteer E2E Live Test (`scratch/verify_question_flow.cjs`):
  - Card rendered with non-uppercase bold header (`"textTransform": "none"`, `"fontWeight": "600"`) and solid white badge (`"badgeBg": "rgb(255, 255, 255)"`).
  - Option 1 clicked live via browser.
  - Question immediately marked answered (`[data-testid="question-prompt-card-answered"]`).
  - Tool question resolved with `status: "completed"`, `answers: [["Rekap Bulanan"]]`, `error: undefined`.
  - Assistant continuation turn received immediately without TimeoutError.

## Notes
- Live flow tested end-to-end on running Arunaki workstation instance.
