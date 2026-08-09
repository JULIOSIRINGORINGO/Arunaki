# TOOL RENAME → `read`/`write`/`edit` — Progress Checklist

**Date:** 2026-08-09
**Status:** ✅ 100% SELESAI — seluruh pengerjaan & tes berhasil
**Referensi keputusan:** `docs/TOOL-NAMING-RESEARCH.md`

> Keputusan: pola OpenCode murni. Tool file workspace direname ke 1 kata:
> `read_workspace_file`→`read`, `write_workspace_file`→`write`, `edit_workspace_file`→`edit`,
> `delete_workspace_file`→`delete`, `rename_workspace_file`→`rename`, `list_workspace_files`→`list`.
> Deskripsi tool = bahasa Inggris. User chat tetap bahasa Indonesia (model yang menjembatani).

---

## ✅ SELESAI — seluruh item telah dikerjakan

### 1. Rename definisi tool di `tools-provider.module.ts`
- [x] `list` — deskripsi bahasa Inggris
- [x] `read` — deskripsi bahasa Inggris
- [x] `write` — deskripsi bahasa Inggris
- [x] `delete` — deskripsi bahasa Inggris
- [x] `rename` — deskripsi bahasa Inggris
- [x] `edit` — deskripsi bahasa Inggris, `estimatedLatency: slow`, `timeoutMs: 60000`

### 2. Fuzzy replacer di `workspace-tools.service.ts` `editWorkspaceFile`
- [x] Exact match + CRLF tolerance
- [x] Guard `isDisproportionate` — tolak replacement span jauh lebih besar dari oldText
- [x] `LineTrimmedReplacer` — fallback cocokkan baris per baris setelah trim
- [x] `BlockAnchorReplacer` — fallback anchor baris pertama & terakhir, ukuran kandidat 0.65×–1.5× oldText
- [x] Error message `OLD_TEXT_NOT_FOUND` — metadata sudah pakai `toolName: 'edit'`

### 3. Runner — `workspace-runner.service.ts`
- [x] `selectToolsForGoal` — always-available sudah pakai `read`, `write`, `edit`, `list`
- [x] Prompt @mention — self-healing `executeWithHealing('read', ...)`, pesan generik `panggil tool write ... PERTAHANKAN struktur file asli`

### 4. Verifikasi pasca-write
- [x] `write` untuk file existing: `recalculateAndVerify(contentToWrite, '')` + structure guard `missingSectionLabels` → reject `TOTAL_MISMATCH` / `STRUCTURE_CHANGED`
- [x] `edit`: `recalculateAndVerify(updated, instructions)` → reject `TOTAL_MISMATCH`
- [x] `workspace.controller.ts`: `res.on('close')` / `res.on('aborted')` → `abortRun(id, 'client disconnected')`

### 5. Referensi nama lama di file RUNTIME
- [x] `apps/api/src/modules/tools/tool-registry.service.ts` — `coreToolNames` mengarah ke `read` / `write`.
- [x] `apps/api/src/modules/ai/self-healing.service.ts` — `fallbackMap` mengarah ke `read: ['list']`.
- [x] `apps/api/src/modules/tools/utils/tool-middleware.wrapper.ts` — saran error mengarah ke `"list"`.

### 6. File prompt yang DIBACA MODEL
- [x] `apps/api/src/prompts/rules.md` — rujukan diperbarui ke `read`, `edit`, `write`.
- [x] `apps/api/src/prompts/chat-rules.md` — rujukan diperbarui ke `write`.

### 7. Spec test yang menggunakan nama tool
- [x] `tool-registry.service.spec.ts` — 100% pass
- [x] `workspace-runner.service.spec.ts` — 100% pass
- [x] `self-healing.service.spec.ts` — 100% pass
- [x] `tool-call-repair.spec.ts` & `tool-call-repair.integration.spec.ts` — 100% pass
- [x] `sub-agent-runner.service.spec.ts` — 100% pass
- [x] `integration-stress.spec.ts` — 100% pass
- [x] `trajectory-audit.service.spec.ts` — 100% pass
- [x] `context-manager.spec.ts` — 100% pass

### 8. Test harness & Verifikasi
- [x] `npx tsc --noEmit -p tsconfig.build.json` → EXIT 0
- [x] `npx vitest run` → 29 test files passed (142 passed)

### 9. Dokumentasi & Git
- [x] Commit & push perbaikan runtime, prompts, dan tests ke GitHub.
