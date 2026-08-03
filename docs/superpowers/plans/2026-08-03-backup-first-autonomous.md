# Backup‑First Autonomous Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB‑SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task‑by‑task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable autonomous edit of Excel `.xlsm` workbooks (read, search, update) with an automatic backup‑first policy, eliminating manual approval while guaranteeing data safety.

**Architecture:** Introduce a new `BackupService` (backend) that performs multi‑attempt copy, SHA‑256 verification, and pruning of old backups. Mutating file tools (`write_workspace_file`, `delete_workspace_file`, `rename_workspace_file`, `edit_workspace_file`) are wrapped to call `BackupService` before any change. Approval gating now occurs only after a successful backup. Backups are stored under `.arunaki-backups/<workspaceId>/` with a configurable retention of 5 versions per file.

**Tech Stack:** NestJS, TypeScript, Node.js `fs/promises`, `crypto`, existing `StorageService`, `ArtifactService`, `WorkspaceToolsService`.

## Global Constraints
- All file operations must stay within the workspace sandbox (see `BOUNDARIES.md`).
- Mutating actions require a successful backup before proceeding (new policy).
- Retain a maximum of 5 backups per file; older backups are automatically pruned.
- Backup failures abort the edit/delete operation and return `error.code='BACKUP_FAILED'`.
- Macro code in `.xlsm` files must remain untouched; macros execute only when the user opens the workbook in Excel.
---

### Task 1: Add `BackupService`

**Files:**
- Create: `apps/api/src/modules/backup/backup.service.ts`
- Modify: `apps/api/src/modules/backup/backup.module.ts` (register provider)
- Test: `apps/api/src/modules/backup/backup.service.spec.ts`

**Interfaces:**
- Consumes: `StorageService` (read/write), `ArtifactService` (store backup metadata).
- Produces: `createBackup(sourcePath:string):Promise<{path:string;hash:string}>`, `verifyBackup(path:string,expectedHash:string):Promise<boolean>`, `pruneOldBackups(sourcePath:string,keep:number=5):Promise<void>`.

- [ ] **Step 1:** Write failing test for `createBackup` (mock `StorageService.copy`).
- [ ] **Step 2:** Run test → fails (service missing).
- [ ] **Step 3:** Implement minimal `BackupService` copying file, computing SHA‑256, returning metadata.
- [ ] **Step 4:** Run test → passes.
- [ ] **Step 5:** Add retry logic (3 attempts, exponential back‑off) and test that a transient copy error retries.
- [ ] **Step 6:** Add `pruneOldBackups` implementation and test that after 6 backups the oldest is deleted.
- [ ] **Step 7:** Commit.

### Task 2: Integrate `BackupService` into Mutating Tools

**Files:**
- Modify: `apps/api/src/modules/tools/services/workspace-tools.service.ts` (wrap mutating methods).
- Modify: `apps/api/src/modules/workspace/workspace-runner.service.ts` (approval gating after backup).
- Test: `apps/api/src/modules/tools/services/workspace-tools.service.spec.ts` (verify backup call before delete/write).

**Interfaces:**
- Consumes: `BackupService`.
- Produces: same tool signatures; behavior unchanged except backup step.

- [ ] **Step 1:** Write failing test that `deleteWorkspaceFile` calls `BackupService.createBackup` and aborts on error.
- [ ] **Step 2:** Run test → fails (no backup call).
- [ ] **Step 3:** Add `BackupService` injection to constructor, call before file delete/write, handle `BackupError` by returning `ToolResult` with `error.code='BACKUP_FAILED'`.
- [ ] **Step 4:** Run test → passes.
- [ ] **Step 5:** Add similar wrapper for `write_workspace_file`, `rename_workspace_file`, `edit_workspace_file` and corresponding tests.
- [ ] **Step 6:** Adjust `WorkspaceRunnerService` mutation flow: after backup succeeds, emit `approval_required` event; if user rejects, restore latest backup.
- [ ] **Step 7:** Commit.

### Task 3: Update Approval Flow

**Files:**
- Modify: `apps/api/src/modules/workspace/workspace-runner.service.ts` (lines 214‑219, 245‑251).
- Test: `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` (approval after backup).

- [ ] **Step 1:** Write failing test where backup succeeds, user rejects → original file restored from backup.
- [ ] **Step 2:** Implement logic: on rejection, read latest backup, write back to original path, record in `ArtifactService` as `restore`.
- [ ] **Step 3:** Run test → passes.
- [ ] **Step 4:** Commit.

### Task 4: Documentation Updates

**Files:**
- Modify: `docs/BOUNDARIES.md` (add bullet under *File Operations* about backup‑first, retain 5 backups).
- Modify: `docs/AGENTS.md` (note new backup‑first policy, macro unchanged).
- Modify: `docs/ARCHITECTURE.md` (add module table entry for `BackupService`).
- Modify: `docs/INTELLIGENCE.md` (update *Human in Control* section to include automatic backup verification).
- Modify: `docs/WORKFLOW.md` (add checklist item `✅ Implement BackupService & integrate with mutating tools`).

- [ ] **Step 1:** Write test‑like verification (e.g., grep for new bullet) → fails.
- [ ] **Step 2:** Add the documentation edits.
- [ ] **Step 3:** Run grep check → passes.
- [ ] **Step 4:** Commit.

### Task 5: End‑to‑End Integration Test

**Files:**
- Create: `apps/api/src/modules/integration/backup-edit.integration.spec.ts`

- [ ] **Step 1:** Write test that uploads a mock `.xlsm`, calls `write_workspace_file` to modify a cell, asserts backup files exist (5 max), asserts macro still present (read via `documentReaderTool`).
- [ ] **Step 2:** Run test → fails (no integration).
- [ ] **Step 3:** Ensure full flow (upload → backup → edit → approval → final file).
- [ ] **Step 4:** Run test → passes.
- [ ] **Step 5:** Commit.

### Task 6: CI / Lint / Build Verification

- Run full `npm test` (should be >= 84 passes).
- Run `npx eslint src/**` (no errors).
- Run `npm run build` (no failures).
- If any fail, debug and repeat until green.

---

**ponytail:** backup‑first replaces pure approval, keeps data safe while allowing autonomous Excel edits.
