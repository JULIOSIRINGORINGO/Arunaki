# Dev Log — Desktop Bridge Unauthorized Fix

**Date & Time:** 2026-08-04 15:15 WIB
**Author:** opencode (big-pickle)

## What

Desktop app (`apps/desktop/main.cjs`) selalu ditolak oleh backend dengan `Unauthorized desktop connection attempt` meskipun client mencetak `Connected to backend`.

**Root cause:** `main.cjs` memuat `.env` manual hanya dari `apps/desktop/.env` (tidak ada), padahal `ARUNAKI_API_KEY` ada di `apps/api/.env`. Backend (via `@nestjs/config`) membaca key-nya dari `apps/api/.env`, desktop membaca `process.env.ARUNAKI_API_KEY` yang kosong → token tidak cocok → `ws.close(1008)` di `desktop-bridge.service.ts:45-49`. Client mencetak "Connected" pada event `open` sebelum ditutup server.

## Files Changed

- `apps/desktop/main.cjs` — env loader kini mencoba `apps/desktop/.env` lalu fallback `apps/api/.env` (memakai `process.env[key]` guard supaya env eksplisit menang).

## Tests

- `node --check apps/desktop/main.cjs` — ✅ syntax OK
- Smoke test ekstraksi regex `.env` → `ARUNAKI_API_KEY` terbaca (32 chars) — ✅

## Notes

- Tidak menambah dependency (dotenv tetap dihindari).
- Jika desktop di-packaging (Electron build), `.env` backend tidak ikut serta; perlu bundling atau secret terpisah di deployment nanti — di luar scope fix ini.
