# Dev Log — Context-Engine Wired ke Chat Mode (Gap #4)

**Date & Time:** 2026-08-05 10:54:00 WIB
**Author:** AI Software Engineer (opencode)

## What
Menutup Gap #4 (bagian prioritas): `ContextQuarantine` sebelumnya hanya melindungi workspace mode. Chat mode meng-inject `knowledgeContext` langsung ke system prompt tanpa sanitasi prompt-injection — kesenjangan keamanan antar mode. Sekarang chat mode melewati quarantine yang sama. Dead injection `ContextRegistry` di `ai.service.ts` dibersihkan.

## Files Changed
- `apps/api/src/modules/chat/agent-runner.service.ts` — inject `ContextQuarantine`; sanitasi `knowledgeContext` di jalur sync & stream sebelum `getSystemPrompt()`.
- `apps/api/src/modules/ai/context/context-quarantine.service.ts` — `sanitizeText()` dijadikan public (private → `sanitizeTextInternal`) agar bisa dipakai agent-runner.
- `apps/api/src/modules/ai/ai.service.ts` — hapus `@Optional() @Inject(ContextRegistry)` dead injection + import.
- `apps/api/src/modules/ai/context/context-quarantine.service.spec.ts` [NEW] — 3 test.
- `WORKFLOW.md` — Phase 45.4.

## Tests
- `npx vitest run src/modules/ai/context/context-quarantine.service.spec.ts` — 3/3 passed.
- `npx vitest run src/modules/chat` — 10/10 passed.
- `npx vitest run src/modules/ai/ai.service.spec.ts` — passed.
- `npm run build` — 0 errors.

## Notes
- Tidak full-migrate `agent-runner` ke `ContextRegistry.getActive().assemble()` (rekomendasi #3 opsional) — tetap jalur `getSystemPrompt()` + quarantine. Migrasi penuh bisa jadi follow-up terpisah jika mau satu jalur assembly tunggal.
