# Dev Log — 2026-08-05 — Tool Loop Isolation (Gap #16)

## Context
Audit part 2 temuan #16: `ToolLoopDetectorService.clearSession(workspaceId)` tidak pernah dipanggil — `sessionHistory` menumpuk lintas run → false-positive circuit breaker.

## Changes

### 1. clearSession Call at Run Start (#16)
- `workspace-runner.service.ts`: menambahkan `this.toolLoopDetector.clearSession(workspaceId)` di awal tiap run (bersama `modifiedFiles.delete`, `readFiles.delete`, `mentionedFiles.delete`, `todoStore.clear`).
- Ini mengisolasi tool-loop tracking per run — run sebelumnya tidak mencegah run baru dari menjalankan tool yang sama.

### 2. Spec Mock Updates
- `workspace-runner.service.spec.ts`: memperbarui 5 mock `ToolLoopDetectorService` untuk menyertakan `clearSession: vi.fn()` dan 5 mock `CompactionService` untuk menyertakan `compactHistory: vi.fn().mockResolvedValue({ wasCompacted: false })`.

### 3. New Spec
- `tool-loop-detector.service.spec.ts` (3 test):
  - Circuit breaker triggers after 3 identical calls in one session.
  - `clearSession` resets history so next run does not false-positive.
  - Histories of different workspaces are independent.

## Verification Results

### Automated Tests
- Full suite `npm run test` pass (139/139).
- Build `npm run build` pass (0 errors).
