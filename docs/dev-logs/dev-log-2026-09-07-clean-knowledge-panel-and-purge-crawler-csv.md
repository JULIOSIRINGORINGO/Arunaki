# Dev Log — Purge Crawler Text, Remove CSV Button & Streamline Knowledge Node Fields

**Date & Time:** 2026-09-07 18:25:30 WIB  
**Author:** Antigravity AI Software Engineer

## What
Refactored [KnowledgeNodePanel.tsx](file:///E:/JS/Arunika/apps/web/src/components/knowledge/KnowledgeNodePanel.tsx) to eliminate all unnecessary artifacts, legacy crawler text, and CSV clutter:
1. **Purged Legacy Crawler Text**: Removed the old `{urls.length - 1} pages discovered from this site (categories, products...)` text.
2. **Eliminated "Clear raw CSV" & Raw CSV Textarea**:
   - For Spreadsheet / Catalog / Web URL nodes: removed the giant markdown textarea and the out-of-place "Clear raw CSV" button.
   - Replaced it with a clean, compact 2-line "Instructions for AI (Optional)" field for human notes only (e.g. 'Prioritize wholesale prices for VIP customers').
   - Added automatic client-side sanitization on node load: any legacy dump starting with ````csv```` or containing HTML error text is automatically purged to empty string.
3. **Adaptive Fields per Node Type**:
   - `Rules / SOP` nodes show: Title and "SOP & Business Rules" content area. (No URL or location needed).
   - `Spreadsheet / Catalog / URL` nodes show: Title, URL, Live Connected status, Location/Branch, and optional 2-line AI instruction.

## Files Changed
- `apps/web/src/components/knowledge/KnowledgeNodePanel.tsx` — removed crawler discovery text, removed raw CSV dump, eliminated Clear CSV button, adapted fields per node type.

## Tests
- `npm run build -w apps/web` — ✅ passed (16.30s, 0 TS errors)

## Notes
The Edit Node panel is now ultra-clean, minimal, and free of all technical crawler/CSV baggage.
