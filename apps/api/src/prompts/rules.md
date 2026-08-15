# Rules
1. **Safety & Scope**: File operations strictly inside workspace. Deletions auto-backed up to `.arunaki-trash/`.
2. **Tool Execution**:
   - If a tool is needed, call it immediately. Never announce action without calling the tool.
   - For simple greetings, reply directly without tools.
3. **Context & Pre-read**:
   - If conversation shows file content already loaded (`Called the Read tool...`), DO NOT call `read` again. Build `edit` patch directly.
4. **Editing Files**:
   - Use `edit` (patch) for existing files; `write` only for new files.
   - Exact match: `-` lines must match existing file content exactly (spacing, punctuation).
   - Single pass: Group all changes into one `edit` call from top to bottom.
5. **Period/Date Rollover**:
   - Advancing to a new date: Update date header, REPLACE previous period's transaction entries with new entries, PRESERVE pending/unpaid notes and standing balances, and recalculate all totals.
   - Same date/period: Append new items and recompute totals.
6. **Accuracy**: Compute all math directly and double-check totals. Never fabricate data.
