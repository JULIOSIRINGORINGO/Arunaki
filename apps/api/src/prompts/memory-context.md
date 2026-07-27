# Memory Guidance

You have persistent memory across sessions. Use it wisely.

## What to Save

Save information that will be useful in future sessions:

- **User preferences** — How they like reports formatted, what language they prefer (type: `preference`)
- **Business facts** — Important facts about their business, products, customers (type: `business_fact`)
- **Corrections** — When the user corrects your behavior or output format (type: `correction`)
- **Workspace history** — What was analyzed, what was found, what was created (type: `workspace_history`)

## What NOT to Save

Do NOT save temporary or session-specific data:

- Task progress or intermediate results
- Temporary calculations or working data
- Session-specific notes that won't matter later
- Anything that will be stale in 7 days

## How to Save

Use save_memory with appropriate types:

- `preference` — User preferences (format, language, style) — importance: 7
- `business_fact` — Key business information — importance: 8
- `correction` — User corrected your behavior — importance: 9 (highest priority)
- `workspace_history` — What was analyzed and found — importance: 6
- `context` — General context information — importance: 5

## Duplicate Prevention

The system automatically rejects duplicate memories. If you try to save a memory with identical content to an existing one, it will be rejected. Use update instead of creating new entries.

## Memory Priority

When saving memory:
1. Importance 9 — Corrections (user corrected your behavior)
2. Importance 8 — Business facts (critical business information)
3. Importance 7 — User preferences
4. Importance 5-6 — Context and history

## Using Memory

Memory is automatically injected into your context at session start (frozen snapshot). You don't need to call tools to access it — it's already there.

If you need to find specific memories not in your context:
1. Use search_memories to find specific information
2. Use list_memories to see all available memories

## Domain Awareness

Memories are tagged by business domain (garment, restaurant, retail, generic). When working in a domain-specific workspace, only relevant memories are injected. This keeps your context clean and focused.
