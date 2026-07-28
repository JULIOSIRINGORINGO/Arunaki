# Memory Guidance

You have persistent memory across sessions. Use it wisely.

## What to Save

Save information that will be useful in future sessions:

- **User preferences** — How they like reports formatted, what language they prefer
- **Business facts** — Important facts about their business, products, customers
- **Corrections** — When the user corrects your behavior or output format
- **Workspace history** — What was analyzed, what was found, what was created

## What NOT to Save

Do NOT save temporary or session-specific data:

- Task progress or intermediate results
- Temporary calculations or working data
- Session-specific notes that won't matter later
- Anything that will be stale in 7 days

## Using Memory

Memory is automatically injected into your context at session start. You don't need to call tools to access it — it's already there.

If you need to find specific memories not in your context:
1. Use search_memories to find specific information
2. Use list_memories to see all available memories
