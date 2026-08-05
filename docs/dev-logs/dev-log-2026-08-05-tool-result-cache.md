# Dev Log — Dedup/Cache Hasil Tool Call (Gap #3)

**Date & Time:** 2026-08-05 10:48:00 WIB
**Author:** AI Software Engineer (opencode)

## What
Menutup Gap #3: menambah layer cache per-run di `ToolRegistryService.executeTool()` untuk tool read-only/idempotent, dengan invalidasi otomatis saat tool mutating jalan.

## Files Changed
- `apps/api/src/modules/tools/interfaces/tool.interface.ts` — field `cacheable?: boolean` (default false).
- `apps/api/src/modules/tools/services/tool-adapter.ts` — propagasi `cacheable` dari `ToolConfig`.
- `apps/api/src/modules/tools/tool-registry.service.ts` — cache `Map<key, {result, expiresAt}>` keyed `scope:name:hash(args)` (scope = workspaceId || runId || default), TTL 60s, bounded 1000; `invalidateCache(scope)` dipanggil sebelum tool mutating jalan; log `[CACHE HIT]`.
- `apps/api/src/modules/tools/tools-provider.module.ts` — `cacheable: true` untuk `doc_search`, `search_workspace`, `list_workspace_files`, `read_workspace_file`.
- `apps/api/src/modules/tools/tool-registry.service.spec.ts` — 3 test cache baru.
- `WORKFLOW.md` — Phase 45.3.

## Tests
- `npx vitest run src/modules/tools/tool-registry.service.spec.ts` — 7/7 passed.
- `npx vitest run src/modules/tools` — 19/19 passed.
- `npm run build` — 0 errors.

## Notes
- `web_search` sengaja TIDAK dicache (hasil berubah) dan semua `MUTATING_TOOLS` tidak dicache.
- Invalidasi per-scope (bukan seluruh cache) — `clearExpiredCache()` hanya dipanggil saat cache hit path untuk cegah pertumbuhan tanpa batas.
