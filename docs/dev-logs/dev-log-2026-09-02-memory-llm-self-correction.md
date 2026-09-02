# Dev Log — LLM Self-Correction Learning (Memory Sentinel)

**Date & Time:** 2026-09-02 WIB
**Author:** opencode agent

## What
Menambahkan **full LLM self-correction** ke sentinel workspace memory (`Memory.Service`)
di engine. Sebelumnya sentinel hanya meng-*re-scan* workspace setelah turn (deterministik,
0 token) — koreksi user **tidak** dideteksi/diekstrak/ditulis ke `ARUNAKI.md`. Kini
sentinel belajar dari koreksi user dengan pipeline hemat token: filter murah dulu, LLM
hanya dipanggil bila filter lolos (turn netral tidak menghabiskan token).

## Files Changed
- `packages/engine/engine/src/arunaki/memory.ts` — pipeline `learnCorrection(sessionID)`:
  1. `sessions.messages` → ambil pesan user terakhir → gate 0-token `mightBeCorrection(text)`
     (regex `jangan|harusnya|itu salah|ubah|lupa|mulai sekarang|…`); turn netral → tidur.
  2. Baca `ARUNAKI.md` + resolve agent/model dari session (`agents.get`,
     `provider.getModel`); provider/model tak terkonfigurasi → tidur silent (`.orElseSucceed`).
  3. 1-shot `LLM.Service.stream` (konteks = turn terakhir + rulebook saat ini) → LLM
     merapikan koreksi user menjadi **satu aturan imperative Bahasa Indonesia** (natural,
     bukan JSON).
  4. `applyCorrections(doc, [rule])` → menulis/menggabungkan section
    `## User Preferences & Learned Corrections` (akumulatif, tanpa duplikasi) + append
    `.arunaki/user-corrections.jsonl` + `syncKnowledge` dual-sync ke knowledge graph.
  - Seluruh pipeline `.orElseSucceed`/`.catchAll`-guarded ⇒ provider tak aktif = tidur.
  - `Interface` + deps `Memory.node` bertambah: `Session.node`, `LLM.node`, `Agent.node`,
    `Provider.node`.
  - Helper murni (testable): `mightBeCorrection`, `applyCorrections`.
- `packages/engine/engine/test/arunaki/memory.test.ts` (NEW) — 5 test deterministik.
- `WORKFLOW.md` — update note Phase 49-50 (blok duplikat, `replaceAll`).

## Tests
- `bun test test/arunaki/memory.test.ts` → ✅ 5 pass, 0 fail, 14 expect (filter positive/
  negative + applyCorrections append/replace/akumulasi/no-op).
- `bun test test/server/httpapi-knowledge.test.ts --timeout 45000` → ✅ 2 pass, 0 fail,
  23 expect (bukti server boots penuh dengan `Memory.node` deps baru).
- `bun -e "import('./src/arunaki/memory.ts')"` → ✅ `LOADED OK` (resolusi `@/…` bundel OK).
- `npm run build -w apps/web` → ✅ built, 0 TS error.
- `bunx tsgo --noEmit` → hanya error cascade pre-existing (`@/…` module-not-found glitch
  yang juga menimpa `agent.ts`/`job.ts`/`file.ts` dll; dibuktikan identik di file lain),
  bukan defect dari perubahan ini.

## Notes
- e2e LLM belum diuji runtime (butuh provider/model/auth terkonfigurasi pengguna) —
  LLM call di-*stub* lewat test deterministik pada filter + `applyCorrections`. Jalur LLM
  aman: bila provider tak ada, pipeline tidur (0 token, tidak pernah crash).
- `user-corrections.jsonl` adalah log mentah koreksi user; section ARUNAKI.md adalah
  hasil rapi dari LLM. Keduanya disimpan di `.arunaki/`.
