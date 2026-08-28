# Dev Log — Replace WorkspaceContext ALS with WorkspaceRef

**Date & Time:** 2026-08-28
**Author:** Arunaki AI Engineer

## What
Hapus `src/control-plane/workspace-context.ts` (AsyncLocalStorage ambient workspace-id) dan ganti semua pembaca dengan channel Effect-native `WorkspaceRef` (Context.Reference fiber-local). ALS tidak pernah di-`provide` langsung — satu-satunya sumber nilainya adalah `bridge.restoreWorkspace` yang diambil dari nilai fiber `WorkspaceRef`. Maka penggantian read-only ini preservasi perilaku (nilai akhir identik).

## Files Changed
- `src/effect/instance-state.ts` — `workspaceID` = `yield* WorkspaceRef` (buang fallback ALS)
- `src/effect/run-service.ts` — `attach()` baca `WorkspaceRef` via `Context.getReferenceUnsafe(fiber.context, ...)` saja
- `src/effect/bridge.ts` — hapus `restoreWorkspace`/ALS; `captureSync` baca fiber `WorkspaceRef`; apakah `fromPromise`/`make()` terbuka tanpa restore ALS
- `src/project/instance-store.ts` — `emitDisposed` jadi `Effect.fn` yang `yield* WorkspaceRef` sebelum `GlobalBus.emit`
- `src/control-plane/workspace-context.ts` — deleted (`git rm`)

## Tests
- `node_modules/.bin/tsgo.exe --noEmit` — 745 error, **0 diff per-file vs HEAD baseline** ✅
- `bun test test/server/httpapi-{instance-context,instance,v2-location}.test.ts` — working: 11 pass/8 fail; HEAD: 10 pass/10 fail/1 error — set kegagalan sama (pre-existing), tanpa regresi ✅

## Notes
- Channel `WorkspaceRef` masih di-populate di `middleware/instance-context.ts` (route.workspaceID) dan `attachWith` — tidak berubah.
- `src/util/local-context.ts` DIJAGA (masih dipakai `instance-context.ts`).