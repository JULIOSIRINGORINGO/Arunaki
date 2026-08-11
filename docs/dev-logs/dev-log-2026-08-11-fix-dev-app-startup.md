# Dev Log — Fix dev-app Startup Timeout

**Date & Time:** 2026-08-11 21:40:00 WIB  
**Author:** Antigravity

## What
Fixed `npm run dev:app` timeout failure where the script failed with `[dev-app] GAGAL: API tidak merespon setelah 60 detik`.

## Root Cause
1. `scripts/dev-app.cjs` spawned workspace dev processes without setting explicit workspace working directories (`cwd`), causing NestJS to start in the root directory `e:\ARUNAKI`.
2. NestJS `ConfigModule` did not find `.env` in `process.cwd()` because root directory had no `.env` file (`apps/api/.env` was ignored).

## Files Changed
- `apps/api/src/config/config.module.ts` — Added `envFilePath: ['.env', 'apps/api/.env']` fallback to `NestConfigModule.forRoot()`.
- `scripts/dev-app.cjs` — Updated `start()` helper to accept `options.cwd` and pass explicit workspace directories (`apps/api`, `apps/web`, `apps/desktop`).

## Tests
- `git status` — verified modified files
- `npm test` — ✅ 29/29 test files passed (142/142 tests)

## Notes
- `npm run dev:app` can now be run from root workspace directory reliably.
