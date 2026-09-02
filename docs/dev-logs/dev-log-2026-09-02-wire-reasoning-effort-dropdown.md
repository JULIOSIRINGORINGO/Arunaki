# Dev Log — Connect reasoning effort dropdown to native model variants

**Date & Time:** 2026-09-02 WIB
**Author:** opencode (AI agent)

## What
Dropdown "Reasoning" (Default/Low/Medium/High) di chat area sebelumnya murni UI
(state `reasoningEffort` tidak pernah dikirim ke manapun). Dikoneksikan ke mekanisme
bawaan engine OpenCode: model **variant** dengan `reasoningEffort` (mis. variant
`high` = `{ reasoningEffort: "high" }`, dihasilkan `provider/transform.ts`; dipetakan
ke `reasoning_effort` saat request oleh `session/llm/request.ts:81`). Engine sudah
mendukung `variant` per-prompt di service layer (`PromptInput.variant`,
`session/prompt.ts:652,664,675-687`), hanya HTTP payload yang belum expose field itu.

## Files Changed
- `packages/engine/protocol/src/groups/session.ts` — payload `session.prompt`
  tambah field optional `variant: Model.VariantID.pipe(Schema.optional)`. Handler
  sync (`SessionHttpApi.prompt`) dan async (`promptAsync`) sudah spread `...ctx.payload`
  ke `promptSvc.prompt`, jadi menembus tanpa edit handler. Backward-compatible.
- `apps/web/src/lib/engine.ts` — `sendPrompt(sessionID, content, opts?: { variant? })`
- `apps/web/src/pages/UnifiedWorkstationPage.tsx` — `sendPrompt(chatIdToUse, userText,
  { variant: reasoningEffort || undefined })`

## Tests
- `bunx tsgo --noEmit` (packages/engine/engine) — ✅ 0 error.
- `npm run build -w apps/web` — ✅ (0 TypeScript error).
- `bun test test/server/httpapi-session.test.ts` — fail 3 (baseline lingkungan,
  identik dengan kondisi sebelum perubahan via `git stash`); tidak ada regresi.
  Run pertama sempat 1 flake tambahan (port/state), run ulang konsisten 3 fail.

## Notes
- Nilai dropdown `low`/`medium`/`high` cocok dengan id variant engine
  (`WIDELY_SUPPORTED_EFFORTS`, `ReasoningEfforts` di `llm/schema/ids.ts`). Jika model
  tidak punya tier tsb, `request.ts:81` `variants[id]` kosong → default (no-op), aman.
- Effort dipersist ke model sesi (`setAgentModel`) saat prompt dikirim, sehingga
  turn berikutnya pada sesi yang sama tetap memakai variant tsb.
- Alternatif (tidak dipakai): `session.switchModel` — butuh resolusi model ref di
  frontend; per-prompt `variant` dipilih karena lebih pendek dan bekerja sebelum
  model sesi tersolve.