# Live QA Report — Workspace Agent

**Date:** 2026-07-31
**Scope:** Live API SSE testing against real configured LLM, physical filesystem verification, isolated temporary workspace only.
**Not scope:** Browser/Electron UI interaction. UI flow has not yet been independently verified.

## Test Environment

- API endpoint: `POST /api/v1/workspaces/:id/agent/stream`
- Workspace root: `C:\Users\AMD\AppData\Local\Temp\opencode\arunaki-live-qa`
- API build: `npm run build` completed before test.
- Evidence JSON:
  - `C:\Users\AMD\AppData\Local\Temp\opencode\arunaki-live-qa-report.json`
  - `C:\Users\AMD\AppData\Local\Temp\opencode\arunaki-exact-name-qa-report.json`
- No business workspace files used.

## Result Summary

| Scenario | Tool result | Physical file result | LLM final reply | Verdict |
|---|---|---|---|---|
| Create `qa-brief.txt` with `STATUS: DRAFT` | `write_workspace_file`: success | File exists; content exactly `STATUS: DRAFT` | `File \`qa-brief.txt\` telah dibuat dengan isi: **STATUS: DRAFT**` | PASS |
| Edit `qa-brief.txt` to `STATUS: FINAL` | `write_workspace_file`: success | File content exactly `STATUS: FINAL` | `File \`qa-brief.txt\` telah diperbarui. Isi sekarang: **STATUS: FINAL**` | PASS |
| Delete via `Hapus file itu.` | `delete_workspace_file`: success | File absent | `File \`qa-brief.txt\` telah dihapus.` | PASS |
| Create exact multi-word filename | `write_workspace_file`: success | Exact file `Laporan QA Final 2026.txt`; no renamed duplicate | `File **Laporan QA Final 2026.txt** telah dibuat dengan isi "BARIS SATU".` | PASS |
| Edit exact multi-word filename | `write_workspace_file`: success | Exact file content changed to `BARIS DUA` | `File **Laporan QA Final 2026.txt** berhasil diubah. Isi file sekarang adalah **BARIS DUA**.` | PASS |
| Delete exact file via `Hapus file itu.` | No delete tool call | File remains pending confirmation | `Sebelum saya hapus, perlu konfirmasi Anda: Hapus file **Laporan QA Final 2026.txt** ...?` | PASS: pronoun resolved correctly; pending confirmation by approval gate |
| Confirm deletion with `Ya, hapus file tersebut.` | Not executed | Not verified | API returned `Workspace ... not found` | BLOCKED: QA harness deleted workspace too early |

## Raw SSE Trace

### Run 1 — Create

```text
Goal: Buat file bernama qa-brief.txt dengan isi persis: STATUS: DRAFT
Tool: write_workspace_file
Status: success
Filename: qa-brief.txt
Tool preview: File qa-brief.txt berhasil dibuat di folder workspace.
Final LLM reply: File `qa-brief.txt` telah dibuat dengan isi: **STATUS: DRAFT**
Physical assertion: qa-brief.txt content === STATUS: DRAFT
```

### Run 2 — Edit

```text
Goal: Edit file qa-brief.txt. Ganti seluruh isinya menjadi persis: STATUS: FINAL
Tool: write_workspace_file
Status: success
Filename: qa-brief.txt
Tool preview: File qa-brief.txt berhasil dibuat di folder workspace.
Final LLM reply: File `qa-brief.txt` telah diperbarui. Isi sekarang: **STATUS: FINAL**
Physical assertion: qa-brief.txt content === STATUS: FINAL
```

### Run 3 — Pronoun Delete

```text
Goal: Hapus file itu.
Tool: delete_workspace_file
Status: success
Filename: qa-brief.txt
Tool preview: File "qa-brief.txt" berhasil dihapus dari workspace.
Final LLM reply: File `qa-brief.txt` telah dihapus.
Physical assertion: qa-brief.txt does not exist
```

### Run 4 — Exact Filename Create

```text
Goal: Buat file bernama persis "Laporan QA Final 2026.txt" dengan isi persis: BARIS SATU
Tool: write_workspace_file
Status: success
Filename: Laporan QA Final 2026.txt
Tool preview: File Laporan QA Final 2026.txt berhasil dibuat di folder workspace.
Final LLM reply: File **Laporan QA Final 2026.txt** telah dibuat dengan isi "BARIS SATU".
Physical assertion: directory contains only Laporan QA Final 2026.txt
Physical assertion: content === BARIS SATU
```

### Run 5 — Exact Filename Edit

```text
Goal: Edit file "Laporan QA Final 2026.txt". Ganti seluruh isi menjadi persis: BARIS DUA
Tool: write_workspace_file
Status: success
Filename: Laporan QA Final 2026.txt
Tool preview: File Laporan QA Final 2026.txt berhasil dibuat di folder workspace.
Final LLM reply: File **Laporan QA Final 2026.txt** berhasil diubah. Isi file sekarang adalah **BARIS DUA**.
Physical assertion: content === BARIS DUA
```

### Run 6 — Exact Filename Pronoun Resolution

```text
Goal: Hapus file itu.
Tool: none
Final LLM reply: Sebelum saya hapus, perlu konfirmasi Anda:
Hapus file **Laporan QA Final 2026.txt** (berisi "BARIS DUA") dari Workspace?
Silakan jawab ya/tidak.
Assertion: model resolved "itu" to exact multi-word filename.
```

## Findings

### Verified

1. Native LLM Function Calling chooses exact multi-word filename correctly in tested request.
2. Create and overwrite behavior changes physical file content exactly as requested.
3. Conversation history lets model resolve `file itu` to prior file in both simple and multi-word filename scenarios.
4. Natural post-tool LLM replies now appear after write/delete; prior `fileWritten` early-break behavior is no longer observed in these tests.
5. Delete approval gate requests confirmation for exact multi-word target rather than guessing another file.

### Not Verified

1. **UI transport:** Browser UI `WorkspacePage` session serialization, SSE rendering, loading state, and displayed filenames were not tested here. This report proves API-level behavior only.
2. **Confirmed deletion:** Harness cleanup deleted test workspace after initial result and then tried to parse `204 No Content` as JSON. Confirmation follow-up returned `Workspace not found`. This is a QA harness lifecycle bug; not an agent behavior result.
3. **Ambiguous contexts:** Multiple similarly named files, malformed filename instructions, non-ASCII names, nested paths, and document formats remain untested.

## UI Risk

User reported UI sometimes shows wrong steps or wrong filename despite changed file. API pass does not invalidate that report. Likely boundaries to inspect next:

1. `WorkspacePage.tsx` serializes session history and receives SSE events.
2. UI labels derive filename from `event.data.args.filename || event.data.args.path` before tool result arrives.
3. Tool call arguments can differ from final resolved filename in `tool_done.result.metadata.filename`.
4. UI currently may display requested/proposed name at `tool_start`, but physical output must use resolved name from `tool_done`.

QA acceptance must compare all three values:

```text
requested filename
→ tool_start args filename
→ tool_done metadata.filename
→ physical filesystem filename
→ final LLM response filename
```

Any mismatch is a failure, even if file content changes.

## Next QA Cases

1. Repair harness cleanup; preserve workspace until confirmation follow-up completes.
2. Browser UI test through Electron/Playwright: verify step label changes from proposed to resolved filename after `tool_done`.
3. Multiple files: `laporan.txt`, `laporan final.txt`, `laporan-final.txt`; test exact requested target and pronouns.
4. Nested path create/edit/delete: `subfolder/Laporan QA.txt`.
5. Typo request: `test pormat text`; check model either asks clarification or normalizes deliberately, never silently invents a filename.
6. Failure injection: read-only folder / invalid path; UI and final LLM reply must show same failure.

## Verdict

**API-level create, edit, exact filename preservation, history-based pronoun resolution, and simple pronoun delete pass in live LLM tests.**

**UI behavior is not yet verified. Do not claim UI filename/step correctness until browser/Electron QA compares SSE labels, resolved tool result, final reply, and physical filename.**
