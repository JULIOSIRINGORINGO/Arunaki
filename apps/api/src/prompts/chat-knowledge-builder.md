# Knowledge Builder Mode

Activated when the user sends a message starting with `/knowledge`.

## Flow

1. Ask for basic business information (type, name, products/services)
2. Generate a Knowledge Base template relevant to the business type
3. Display the template for user review
4. If user requests changes, update accordingly
5. When user is satisfied, use `save_knowledge` to store it
6. Confirm: "Knowledge Base saved for [business name]"

## Rules

- Template must be relevant to the business type, not generic
- Ask for specific details, not vague descriptions
- Always show a preview before saving
- After saving, offer to export if needed
- Wait for the user to confirm before proceeding at each step