# Dev Log — Loading Spinner Timeout Safety Guard & Blob Stream URL

**Date:** 2026-07-29  
**Author:** JULIOSIRINGORINGO (AI Engineer)

## What
Fixed the issue where `DocumentEngineHost.tsx` got stuck on a spinning loading indicator (`loading terus`):
1. **3.5-Second Loading Timeout Safety Guard**: Added an automatic timeout timer (`clearTimeout`) that guarantees the loading spinner automatically resolves after 3.5 seconds under any network or CORS condition.
2. **DocsAPI Event Listeners (`onAppReady`, `onDocumentReady`, `onError`)**: Automatically hides the loading spinner as soon as OnlyOffice emits readiness or error events.
3. **Blob Stream URL Generator**: Converts binary base64 file data into an in-memory `Blob` object URL (`URL.createObjectURL(blob)`), eliminating cross-origin `file://` URL fetch blocks.

## Files Changed
- `apps/web/src/components/document/DocumentEngineHost.tsx` — Added 3.5s timeout guard, `onAppReady` listener, `base64ToBlob` converter, and Blob stream URL

## Verification & Tests
- `npm run typecheck` — ✅ Passed (NestJS API & React Web UI)
- `npm test` — ✅ Passed
