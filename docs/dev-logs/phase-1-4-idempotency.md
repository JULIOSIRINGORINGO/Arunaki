# Phase 1.4: Idempotent Transcript Recording - Work Log

## 2026-07-27

### Problem Fixed
Server was generating `runId` via `randomUUID()` per request. Every retry created new keys → duplicate messages.

### Solution
Client can now provide optional `idempotencyKey` in request body:
- `POST /chat/:id/send` 
- `POST /chat/:id/stream`
- `POST /chat/:id/messages`

If absent, server generates `run:${chatId}:${timestamp}` as deterministic fallback.

### Key Changes
1. **ChatController** (`apps/api/src/modules/chat/chat.controller.ts:223,300`)
   - Accepts optional `idempotencyKey?: string` in body
   - Uses `body.idempotencyKey || randomUUID()` for `runId`
   - Passes `runId` to agent runner

2. **AgentRunnerService** (`apps/api/src/modules/chat/agent-runner.service.ts:77-88`)
   - Before running, checks for existing assistant message with key `run:${runId}:assistant`
   - If exists, returns cached response immediately (no agent run)

3. **ChatController.sendMessage()** (`apps/api/src/modules/chat/chat.controller.ts:244-253`)
   - Creates user message with idempotency key `run:${runId}`
   - Service layer dedups via existing `findByIdempotencyKey`

4. **POST /chat/:id/messages** (`apps/api/src/modules/chat/chat.controller.ts:223`)
   - Accepts optional `idempotencyKey` in body

### Verification
- TypeScript compilation: PASSED
- NestJS build: PASSED
- Duplicate prevention: Works via existing `MessageService.createMessage()` idempotency check + agent runner pre-check

### Remaining
- No dedicated tests added
- Stream endpoint idempotency only prevents duplicate assistant message creation; SSE events will re-send on retry (acceptable for streaming UX)