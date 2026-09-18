# Dev Log — Fix Cross-Folder Session Leak & Enforce Strict Directory Binding

**Date & Time:** 2026-09-18 17:15:00 WIB
**Author:** Antigravity AI

## What
Investigated and resolved a critical folder isolation leak where the agent executed operations (creating `.arunaki/`, `.arunaki-backups/`, and `Pemasukan-2026-09-18.xlsx`) in the wrong workspace folder (`e:\JS\Arunika`) instead of the active user-selected folder (`E:\REKAPAN`).

Identified and plugged 5 leak vectors:
1. **History Page Cross-Contamination (`HistoryPage.tsx`)**: Clicking an old chat session paired `localStorage.getItem("arunaki_active_folder")` (e.g. `E:\REKAPAN`) with an old session ID created in `e:\JS\Arunika`. Fixed by preserving `s.directory` from backend and switching active folder directly to the session's native folder.
2. **Global Fallback in Workstation (`UnifiedWorkstationPage.tsx`)**: If `arunaki_active_chat_id_${initialFolder}` was missing, it fell back to global `arunaki_active_chat_id` containing the previous folder's session. Fixed by eliminating the cross-folder fallback and adding a session-directory isolation guard effect.
3. **Pre-flight Check in Chat Hook (`useWorkstationChat.ts`)**: `handleSendMessage` now verifies the session's backend directory via `getSession` before sending the prompt; if mismatched with `activeFolder`, it drops the stale session ID and spawns a fresh session explicitly bound to `activeFolder`.
4. **Engine CreateSession Payload (`engine.ts`)**: Fixed payload schema from `{ location: { type: "directory", directory } }` to `{ location: { directory } }` and appended `directory` & `location[directory]` query parameters and `x-arunaki-directory` header.
5. **AppLayout Folder Handlers (`AppLayout.tsx`)**: Switching or opening a folder now loads the isolated `arunaki_active_chat_id_${path}` or clears `arunaki_active_chat_id` instead of carrying over the old folder's session ID.

## Files Changed
- `apps/web/src/lib/engine.ts` — Fixed `createSession` payload schema & added directory parameters.
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — Removed cross-folder session fallback and added session directory isolation guard.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Added pre-flight session directory verification before dispatching messages.
- `apps/web/src/pages/HistoryPage.tsx` — Preserved `session.directory`, and bound folder switching strictly to session directory on click.
- `apps/web/src/components/history/historyUtils.ts` — Added `directory` field to `ChatSession` interface.
- `apps/web/src/components/history/HistorySessionItem.tsx` — Added folder badge display for transparent session folder attribution.
- `apps/web/src/components/layout/AppLayout.tsx` — Strictly isolated active chat per folder on folder open, close, and workstation navigation.

## Tests
- `npm run build -w apps/web` — ✅ passed (TypeScript compilation and Vite bundle clean with 0 errors)
- Cleaned up uncommitted leaked file `Pemasukan-2026-09-18.xlsx` from workspace root.

## Notes
Strict compliance with `AGENTS.md` "Project Folder Isolation (CRITICAL) — Agent only accesses the active project folder. NOT the entire computer. Satu window/jendela = satu folder proyek aktif = satu agent session."
