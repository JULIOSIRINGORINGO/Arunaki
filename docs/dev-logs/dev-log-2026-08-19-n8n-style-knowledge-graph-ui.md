# Dev Log — n8n/Flowise Style Minimalist Knowledge Graph UI

**Date & Time:** 2026-08-19 11:25:00 WIB
**Author:** Antigravity AI

## What
Redesigned the Knowledge Graph canvas and node architecture to match the clean, structured, minimalist visual aesthetics of **n8n / Flowise / Langflow** node workflow systems as requested by the user.

### Visual & Functional Improvements:
1. **Three-Tier Node Visual Hierarchy**:
   - **Central Agent Core Card ("Arunaki Assistant")**:
     - Horizontal wide container card with left bot icon badge, bold title, and subtitle.
     - Dedicated input port (left), output port (right), and 3 bottom sub-ports (`Model`, `Memory`, `Tool`) with micro-connector handles.
   - **Action & Document Workflow Nodes**:
     - Clean compact square cards (`rounded-2xl bg-[var(--bg-card)] border border-[var(--border-strong)]`) with centered icon in semantic pastel badge (e.g. Sky for Documents, Emerald for Spreadsheets, Amber for Rules, Blue for Telegram, Indigo for Memory).
     - Title and Type subtitle neatly centered underneath.
     - 4-directional handles (Left input, Right output, Top/Bottom vertical routing).
   - **Resource Sub-Nodes (Circular Hanging Badges)**:
     - Sleek circular nodes (`w-13 h-13 rounded-full`) for Tools, Memory models, and LLM providers hanging below the main agent, with top connector port badges.
2. **Horizontal Workflow Routing & Smooth Edges**:
   - Upgraded default ReactFlow edges to smooth, theme-adaptive bezier curves with arrows and subtle animation.
   - Background canvas updated with high-contrast dot matrix grid (`gap={20}, size={1.2}`) adapting to Light and Dark modes.
3. **Full Theme Adaptation & Zero Shadows**:
   - Full flat aesthetic with crisp 1px borders seamlessly supporting both Light and Dark modes.

## Files Changed
- `apps/web/src/components/knowledge/KnowledgeNode.tsx`
- `apps/web/src/pages/KnowledgePage.tsx`
- `apps/web/src/components/knowledge/KnowledgeToolbar.tsx`
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2201 modules transformed)
