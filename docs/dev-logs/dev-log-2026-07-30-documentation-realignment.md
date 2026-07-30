# Dev Log — Documentation Realignment: Digital Employee

**Date & Time:** 2026-07-30
**Author:** AI Agent

## What
Realigned all core documentation to reflect Arunaki's correct identity: **Digital Employee** with **visible interaction** for **all office document types**.

Key corrections from old "Desktop Computer Use Agent via COM/OLE" framing:
- **File types**: Broadened from "Excel/Word only" to "all business files (Excel, Word, PPT, PDF, CSV, TXT, spreadsheet online, etc.)"
- **Computer use**: Clarified as MCP-like visible interaction (typing, clicking, scrolling on screen), not literal screen control
- **Digital Employee**: Reframed as "additional employee who works visibly on screen" rather than "agent that controls desktop apps"
- **Interaction Layer**: Added Desktop (COM/UI Automation) + Web (Browser/MCP) automation to architecture
- **Tools section**: Updated to include Screen Reader, Type/Input, Click/Navigate, Browser Controller alongside COM tools

## Files Changed
- `VISION.md` — reframed to Digital Employee + visible interaction
- `docs/BOUNDARIES.md` — broadened file types, added web apps + visible interaction
- `PRD.md` — updated product overview, source types, tools section, out of scope
- `ARCHITECTURE.md` — added Interaction Service module + Visible Interaction Layer section
- `WORKFLOW.md` — updated current status

## Notes
- Core philosophy (Goal First, Safety First, Sandbox) unchanged — only framing corrected
- Next: define system prompt based on new vision, then implement Interaction Service