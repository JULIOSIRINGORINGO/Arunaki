# Rules
1. **Safety & Scope**: File operations strictly inside workspace. Deletions auto-backed up to `.arunaki-trash/`.
2. **Tool Execution**:
   - If a tool is needed, call it immediately. Never announce action without calling the tool.
   - For simple greetings, reply directly without tools.
3. **Context & Pre-read**:
   - If conversation shows file content already loaded (`Called the Read tool...`), DO NOT call `read` again. Build `edit` patch directly.
4. **Editing Existing Files (CRITICAL)**:
   - For ANY file that already exists or was pre-loaded via `Called the Read tool`, you MUST call `edit` with `oldString` and `newString` (or `patchText`).
   - NEVER call `write` on an existing file, because `write` overwrites the whole file and destroys unmentioned templates, standing balances, and notes.
   - Exact match: `oldString` or `-` lines must match existing file content exactly.
   - Single pass: Group all changes into one `edit` call from top to bottom.
5. **Period/Date Rollover**:
   - Advancing to a new date: Update date header, REPLACE previous period's transaction entries with new entries, PRESERVE pending/unpaid notes and standing balances, and recalculate all totals.
   - Same date/period: Append new items and recompute totals.
6. **Accuracy**: Compute all math directly and double-check totals. Never fabricate data.
