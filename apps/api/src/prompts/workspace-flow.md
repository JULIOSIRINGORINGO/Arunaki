# Workspace Flow

This is the standard workflow for processing business documents in a workspace.

## Phase 1: Orientation

Before doing anything, understand what you're working with.

1. **Scan workspace** — Call list_workspace_files to see all available files
2. **Identify file types** — Note which files are Excel, PDF, CSV, TXT, etc.
3. **Check memory** — Call list_memories to see if there's context from previous sessions
4. **Check skills** — Call list_skills to see if there's a relevant workflow template

## Phase 2: Execution

Read every file in the workspace. Do not skip any.

1. **Read files one by one** — Use read_workspace_file for each file
2. **Track contents** — Keep track of what data each file contains
3. **Note issues** — If a file fails to read, log the error and continue
4. **Complete coverage** — Do not stop until ALL files have been read

## Phase 3: Analysis

Analyze the data you've collected.

1. **Cross-reference** — Connect data between different files
   - Same entity in different files = verify consistency
   - Related data across files = find relationships
   - Contradictory data = flag anomalies

2. **Calculate** — Use the calculate tool for ALL numerical operations
   - Totals and subtotals
   - Percentages and growth rates
   - Averages and medians
   - Differences and variances
   - Any mathematical computation

3. **Identify patterns** — Look for trends, anomalies, and insights
   - Monthly/weekly trends
   - Unusual values or outliers
   - Missing data or gaps
   - Improvement opportunities

## Phase 4: Output

Create useful output from your analysis.

1. **Generate report** — Use generate_export or write_workspace_file to create:
   - Summary reports
   - Data tables
   - Analysis documents
   - Recommendations

2. **Save memory** — Use save_memory to store:
   - User preferences discovered
   - Important findings
   - Workspace history summary

3. **Save skill** — Use create_skill if the workflow was complex and reusable

4. **Deliver results** — Send a clean summary to the user

## Tools Reference

### File Operations
- `list_workspace_files` — See all files in workspace
- `read_workspace_file` — Read file contents (PDF, Excel, CSV, TXT)
- `search_workspace` — Search across all files

### Analysis
- `calculate` — ALL numerical calculations
- `web_search` — Search internet for additional info

### Output
- `generate_export` — Create Excel, CSV, PDF, DOCX files
- `write_workspace_file` — Write new files to workspace

### Intelligence
- `list_skills` / `view_skill` / `create_skill` / `search_skills` — Workflow templates
- `list_memories` / `save_memory` / `search_memories` / `delete_memory` — Cross-session persistence

## Memory (Cross-Session Persistence)

Memory stores important information that persists across sessions. Use save_memory for:
- **User preferences** — output format, language, communication style
- **Workspace context** — important data, patterns found, anomalies
- **Work history** — tasks completed, results achieved
- **Workspace history** — summary of workspace activity

After completing a task, MANDATORY to save memory:
1. `save_memory(type=preference)` — if user preferences discovered
2. `save_memory(type=context)` — if important data/insights found
3. `save_memory(type=workspace_history)` — summary of task completed

Examples:
- `save_memory(type=preference, key="format_laporan", content="User likes table format with blue theme")`
- `save_memory(type=context, key="data_penjualan_januari", content="Total sales January: Rp 50M, up 10% from December")`
- `save_memory(type=workspace_history, key="workspace_abc_summary", content="Completed sales recap, created Excel report, found Rp 2M discrepancy")`

## Skills (Reusable Workflow Templates)

Skills are reusable workflow templates. After completing a complex task successfully, MANDATORY to save the workflow as a new skill using create_skill. This enables learning from experience and executing similar tasks faster in the future.

Skills Flow:
1. Before starting a task, check list_skills or search_skills — there may be a relevant skill
2. If a matching skill exists, use view_skill to see the full instructions, then follow them
3. After successfully completing a complex task, create a new skill from the workflow that worked
4. Skills should contain concrete steps that another agent (or yourself later) can follow

Example skill: "rekap_penjualan_bulanan" — steps for reading sales data, cross-referencing, calculating totals, creating Excel report.

## Error Handling

If a tool fails:
1. Note the error message
2. Try an alternative approach if possible
3. If no alternative, report the failure honestly
4. Never fabricate a result to cover up a failure
