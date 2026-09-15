# Dev Log — Fix Kenari Model Syncing, Paid Model Billing Leak & Pool Persistence

**Date & Time:** 2026-09-15 19:10:00 WIB  
**Author:** AI Software Engineer  

## What
Memperbaiki bug kritis tombol "Sync from API" yang tidak me-refresh katalog live (tetap menampilkan 92 model lama termasuk model-model yang sudah mati/discontinued), kebocoran rute ke model berbayar (*paid charge leak*) pada engine yang memotong saldo pengguna saat memilih model `:free`, dan bug reset otomatis pengaturan model pool ke default saat pengguna memilih lebih dari 10 model.

## Root Causes Identified & Fixed
1. **Tombol "Sync from API" Tidak Menyaring Model Mati**:
   - `handleFetchModelsInForm` di `ModelProviderSettings.tsx` sebelumnya melakukan union `new Set([...existingSelected, ...fetchedModels])`. Hal ini menyebabkan model-model mati yang ada di `existingSelected` (`kimi-k2-7-code:free`, `mistral-large:free`, `deepseek-v4-flash:free`, `ling-3-0-tiny:free`, dll.) tetap tersimpan di katalog (sehingga UI menampilkan 92 model, bukan 81 model asli Kenari).
   - **Solusi**: `formAvailableModels` kini langsung ditimpa (*overwritten*) dengan `fetchedModels` dari endpoint live API (81 model), cache `customModelsMap` diperbarui, dan model-model mati otomatis dipangkas (*pruned*) dari antrean terpilih (`form.model`) serta langsung disinkronkan ke `localStorage`.
2. **Paid Model Charge Leak (CRITICAL)**:
   - Di `packages/engine/core/src/session/runner/model.ts`, pencocokan model menggunakan `requestedID.includes(model.id)`. Saat pengguna meminta `nemotron-3-ultra-550b-a55b:free`, `nemotron-3-ultra-550b-a55b` (versi berbayar yang terletak sebelum versi gratis di katalog) mengevaluasi `true` dan dipilih oleh engine. Hal ini menyebabkan saldo Kenari pengguna terpotong sebesar Rp1.062,70 dan Rp1.090,49.
   - **Solusi**: Substring matching dihapus total. Model pencocokan kini menggunakan exact match dan short ID match. Ditambahkan aturan ketat: jika `requestedID.endsWith(":free")`, kandidat **WAJIB** berakhiran `:free`, dan seluruh fallback pool (`candidateWithKey`, `candidateAllAvailable`) hanya mencari model berakhiran `:free`. Kebocoran ke model berbayar kini mustahil terjadi.
3. **Setting Reset Otomatis (`count > 10`)**:
   - Di `apps/web/src/App.tsx`, terdapat logika *self-healing* agresif dari versi lama: jika model di pool berjumlah `> 10`, pool otomatis dipangkas kembali ke 5 default. Karena Kenari memiliki 15 model gratis dan pengguna memilih seluruhnya, setting selalu direset kembali ke default saat aplikasi dibuka atau di-reload.
   - **Solusi**: Logika `count > 10` dihapus sepenuhnya dari startup dan `refreshModelCatalog()`. Pengguna kini bebas memilih berapapun model (15+ model) secara permanen.
4. **Default Kenari Berisi Model Berbayar**:
   - `DEFAULT_MODELS.kenari` di `constants.ts` sebelumnya menaruh `deepseek-v4-flash` (berbayar) di indeks pertama.
   - **Solusi**: Diperbarui dengan model gratis tercepat hasil benchmark: `nemotron-3-super-120b-a12b:free` (1.06s), `glm-4-7-flash:free` (0.69s), `mistral-medium-3-5:free`, `mimo-v2-5:free`, `agnes-2-0-flash:free`, `step-3-7-flash:free`.
5. **Database Engine Synchronization**:
   - Menjalankan `PUT /api/providers/kenari` untuk membersihkan model mati di level engine database, memastikan konfigurasi instance langsung sinkron dengan 15 model gratis live Kenari.

## Files Changed
- `packages/engine/core/src/session/runner/model.ts` — Pencegahan kebocoran model berbayar & exact `:free` matching.
- `apps/web/src/components/settings/ModelProviderSettings.tsx` — Perbaikan tombol "Sync from API", catalog overwrite & pruning model mati.
- `apps/web/src/components/settings/ProviderForm.tsx` — Perbaikan tombol "Select All Free" untuk hanya memilih model aktif.
- `apps/web/src/components/settings/constants.ts` — Update `DEFAULT_MODELS.kenari` dengan model gratis tercepat.
- `apps/web/src/App.tsx` — Penghapusan pemangkasan agresif `count > 10` agar preferensi pengguna tidak direset.
- `WORKFLOW.md` — Dokumentasi Phase 95 (DONE).

## Tests
- `npm run build -w apps/web`: ✅ Passed (0 TypeScript errors, build selesai dalam 25.71s).
- `bun test packages/engine/core/test/models.test.ts`: ✅ 9/9 tests passed.
- Direct API Sync verification: ✅ 81 live models fetched, 15 free models verified.
