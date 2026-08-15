# Dev Log — Phase 46: Template Preservation & Surgical Edit Verification

**Date & Time:** 2026-08-15 11:16:30 WIB  
**Author:** AI Software Engineer (DeepSeek / Arunaki Core)

## What
Surgically enforced the `edit` tool over `write` for existing files across the entire Arunaki agent pipeline to completely protect business templates, standing balances, unpaid notes, and historical data.

1. **Strict Tool Registry Schema & Write Guard:**
   - Updated `WriteToolService` (`write-tool.service.ts`) to immediately reject write calls when a file exists with `FILE_ALREADY_EXISTS`, guiding LLMs to call `edit`.
   - Updated `WorkspaceFileToolsRegistrar` (`workspace-file-tools.registrar.ts`) removing the `overwrite` boolean parameter so LLMs strictly treat `write` as brand-new file creation only.
   - Enhanced `EditToolService` (`edit-tool.service.ts`) to support direct surgical string replacement (`oldString` -> `newString`) with CRLF normalization alongside full unified diff engine (`apply-patch.ts`).
   - Updated `prompts/rules.md` (Rules 4 & 5) enforcing date header rollover and single-pass edits.

2. **Autonomous Verification:**
   - Ran `apps/api/scripts/test-rekap-extended.ts` against live NestJS server and Kenari AI provider (`deepseek-v4-flash`).
   - Achieved 100% test pass rate (17/17 checks passed) in 78.4s.

## Files Changed
- `apps/api/src/modules/tools/services/write-tool.service.ts` — Reject write on existing files with actionable error.
- `apps/api/src/modules/tools/services/edit-tool.service.ts` — Support direct surgical replacement and unified diff.
- `apps/api/src/modules/tools/services/registrars/workspace-file-tools.registrar.ts` — Update tool descriptions and parameters.
- `apps/api/src/modules/ai/sdk-transformer.util.ts` — Map AI SDK `textDelta` and `args` in stream transformer.
- `apps/api/src/prompts/rules.md` — Rule 4 (Edit enforcement) & Rule 5 (Date header rollover).
- `apps/api/scripts/test-rekap-extended.ts` — Extended assertion suite (17 checks).
- `WORKFLOW.md` — Marked Phase 46 complete.

## Tests
- `npx tsx apps/api/scripts/test-rekap-extended.ts` — ✅ 17/17 checks passed:
  - ✅ Tanggal diperbarui ke hari ini (15 AGUSTUS 2026)
  - ✅ CK DEDI ada (300)
  - ✅ CK OWEN ada (200)
  - ✅ CK BAMBANG ada (450)
  - ✅ TOKO JAYA ada (150)
  - ✅ BUK RINA ada (75)
  - ✅ Total BCA = 825 RB
  - ✅ Total BNI = 200 RB
  - ✅ Total CASH = 150 RB
  - ✅ Total Pengeluaran = 570 RB
  - ✅ Pengeluaran LISTRIK 250 ada
  - ✅ Template: SISA PEMBAYARAN (PAK ARNOL) tidak terhapus
  - ✅ Template: BELANJAAN KE LABURA tidak terhapus
  - ✅ Template: TOTAL BELANJA KE BENDONG tidak terhapus
  - ✅ Template: SISA DEPOSIT RP 14.207.640,- tidak terhapus
  - ✅ Template: CI LISOI (10-02-2024) uncompleted note tetap terjaga
  - ✅ Tool: Menggunakan tool "edit" (bukan overwrite "write")

## Notes
The agent now executes in ~78s with `deepseek-v4-flash`, surgical edits preserve 100% of unmentioned template sections, and `write` is permanently locked out on existing documents.
