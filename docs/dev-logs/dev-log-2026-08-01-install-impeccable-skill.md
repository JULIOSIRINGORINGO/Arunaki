# Dev Log — Install Impeccable Design Skill

**Date & Time:** 2026-08-01
**Author:** OpenCode Agent
**Commit:** `1b0a494`

## What
Installed the `impeccable` design skill from [github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable) into the project.

## Files Changed
- Created `.opencode/skills/impeccable/` (147 files, ~3.1MB):
  - `SKILL.md` (v4.0.4, frontmatter: name/description/allowed-tools)
  - `reference/` — 40+ playbooks (craft, audit, critique, polish, layout, typeset, animate, colorize, live, etc.)
  - `scripts/` — self-contained Node scripts (context, detect, detector engine, live browser iteration, palette, etc.)

## Install Method
- Manual copy of `.opencode/skills/impeccable` from upstream (OpenCode-native format).
- Scripts run via `node .opencode/skills/impeccable/scripts/*`.

## Notes
- Full `npx impeccable` CLI NOT installed (would add global npm deps + puppeteer). Skill scripts are self-contained; upgrade path: run `npx impeccable install` if the CLI is desired.
- The two other repos (`ui-ux-pro-max-skill`, `taste-skill`) were NOT installed — user chose "Impeccable only" to avoid duplicating existing `.claude/skills` (brandkit, gpt-taste, image-to-code, etc. already present).
