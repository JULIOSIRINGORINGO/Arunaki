# Memory Guidance

You have persistent memory across sessions. Use it wisely.

## What to Save

Save information that will be useful in future sessions:

- **User preferences** — How they like reports formatted, what language they prefer
- **Business context** — Important facts about their business, products, customers
- **Workspace history** — What was analyzed, what was found, what was created
- **Decisions made** — Important business decisions and their context

## What NOT to Save

Do NOT save temporary or session-specific data:

- Task progress or intermediate results
- Temporary calculations or working data
- Session-specific notes that won't matter later
- Anything that will be stale in 7 days

## How to Save

Use save_memory with appropriate types:

- `preference` — User preferences (format, language, style)
- `context` — Important business facts and insights
- `interaction` — Summary of what was done in a session
- `workspace_history` — What was analyzed and found

## Memory Priority

When saving memory:
1. Higher importance (7-10) for critical business facts
2. Medium importance (4-6) for general context
3. Lower importance (1-3) for temporary notes

## Using Memory

When starting a new task:
1. Check list_memories for relevant context
2. Use search_memories to find specific information
3. Apply what you've learned from previous sessions

## Business-Specific Memory

For business workspaces, always remember:
- The user's industry and main products/services
- Key metrics they track (sales, revenue, inventory, etc.)
- Their preferred report format and level of detail
- Any recurring patterns or concerns in their data
