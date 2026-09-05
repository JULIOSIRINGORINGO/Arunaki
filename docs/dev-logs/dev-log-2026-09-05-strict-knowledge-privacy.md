# Dev Log — Strict Backend Data Isolation in Knowledge Base

**Date & Time:** 2026-09-05 18:53:00 WIB
**Author:** AI Software Engineer (Antigravity)

## What
Fixed an internal backend technical data leak where the AI exposed system filenames (`knowledge.json`, `ARUNAKI.md`), internal IDs (`main-ai-node`, `arunaki-rulebook`, `node-4`), and architecture concepts (`Agent Core`, `Living Rules`, graph edges):
1. **Root Cause**:
   - `packages/engine/engine/src/session/system.ts` filtered out `main-ai-node`, but did not filter out `arunaki-rulebook`, `type: "rules"`, or `type: "agent"` nodes from `.arunaki/knowledge.json`.
   - The `<knowledge_base>` tag exposed raw node titles like `ARUNAKI.md (Living Rules)` to the LLM context.
   - The prompt lacked a strict instruction forbidding the agent from citing internal JSON keys, IDs, or file paths to the end user.
2. **Changes**:
   - In `system.ts`: Excluded `main-ai-node`, `arunaki-rulebook`, and all nodes with `type: "rules"` or `type: "agent"`.
   - Replaced `<knowledge title="..." type="...">` with clean `<data_source name="...">` tags containing only user business data and URLs.
   - Added strict instruction in `system.ts` and `prompt/default.txt`: NEVER leak internal filenames (`knowledge.json`, `ARUNAKI.md`), internal node IDs, graph edge relations, or internal system concepts. Responses must present only clean, user-facing business descriptions.

## Files Changed
- `packages/engine/engine/src/session/system.ts`
- `packages/engine/engine/src/session/prompt/default.txt`

## Tests & Verification
- `npm run build -w apps/web` — ✅ passed (exit code 0, 0 TypeScript errors).
