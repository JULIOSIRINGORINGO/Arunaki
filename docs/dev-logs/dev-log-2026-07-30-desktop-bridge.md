# Dev Log — Desktop Bridge Service

**Date & Time:** 2026-07-30
**Author:** AI Agent

## What
Desktop Bridge Service — WebSocket server (Backend) + Electron client + 5 desktop interaction tools for opening files in native desktop apps (Excel, Word, PowerPoint) and taking screenshots via desktopCapturer.

## Files Changed
- `apps/api/src/modules/interaction/desktop-bridge.service.ts` — new: WebSocket server with request/response pattern
- `apps/api/src/modules/interaction/desktop-bridge.service.spec.ts` — unit tests for WebSocket connection, commands, timeouts, and error handling
- `apps/api/src/modules/interaction/interaction.module.ts` — register DesktopBridgeService
- `apps/api/src/modules/tools/tools-provider.module.ts` — register 5 desktop tools
- `apps/desktop/main.cjs` — Electron WebSocket client + COM handlers & shell fallback
- `apps/api/package.json` — added ws, @types/ws
- `apps/desktop/package.json` — added ws
- `apps/api/src/prompts/rules.md` — updated Section 7.4 with desktop tools
- `apps/api/src/prompts/chat-rules.md` — added Section 6.6 Desktop Interaction
- `WORKFLOW.md` — added Phase 32

## Tests
- `npx vitest run` — passed (6/6 tests passed including 5 unit tests for `DesktopBridgeService`)
- `npx nest build` — passed (0 errors)

## Notes
- Desktop tools return clear "not connected" error if Electron app is not running
- COM via winax for Excel/Word/PowerPoint (Windows only), with graceful fallback to `shell.openPath` if winax/MS Office COM is unavailable
- Path normalization via `path.resolve` for reliable relative path resolution
- Screenshot via Electron desktopCapturer API
