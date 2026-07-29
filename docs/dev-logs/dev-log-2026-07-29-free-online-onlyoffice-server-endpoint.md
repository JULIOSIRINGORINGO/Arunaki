# Dev Log — Free Online OnlyOffice Server Endpoint & One-Click Toggle

**Date:** 2026-07-29  
**Author:** JULIOSIRINGORINGO (AI Engineer)

## What
Added a 100% free online server option and one-click toggle to `DocumentEngineHost.tsx`:
1. **100% Free Open Source Engine**: Clarified that OnlyOffice Document Server Community Edition is 100% free and open-source (AGPLv3) forever.
2. **One-Click Free Public Server Connector**: Added a `🌐 Gunakan OnlyOffice Server Online Gratis` button in `DocumentEngineHost.tsx` fallback UI.
   - Automatically switches `activeServerUrl` to `https://documentserver.onlyoffice.com` (Official free public demo server).
   - Allows users to open and use the OnlyOffice Document Editor instantly without installing Docker or local server dependencies.

## Files Changed
- `apps/web/src/components/document/DocumentEngineHost.tsx` — Added `activeServerUrl` state and one-click free server connector button

## Verification & Tests
- `npm run typecheck` — ✅ Passed (NestJS API & React Web UI)
- `npm test` — ✅ Passed
