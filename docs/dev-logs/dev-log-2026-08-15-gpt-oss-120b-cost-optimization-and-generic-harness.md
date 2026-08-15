# Dev Log — GPT-OSS-120B Cost Optimization & Domain-Agnostic Resilient Document Harness

**Date & Time:** 2026-08-15 19:30:00 WIB  
**Author:** AI Software Engineer

## What
1. **Domain-Agnostic System Rules**: Menghapus seluruh hardcoded keywords dan asumsi template spesifik (seperti `PEMASUKAN`, `PENGELUARAN`, standing balances, atau rollover harian) dari `rules.md`, `chat-rules.md`, dan registrar tool. Menggantinya dengan prinsip editing universal (*Document Structure & Formatting Fidelity*, *Instruction-Driven Modifications*, dan *Surgical Search-and-Replace*) yang berlaku fleksibel untuk file apapun (invoice, daftar stok apotek/minimarket, logbook servis bengkel, tabel markdown, CSV, dll.).
2. **Multi-Block Array Replacements**: Menambahkan kapabilitas `replacements: Array<{ oldString, newString }>` ke `edit-tool.service.ts` dan schema tool di `workspace-file-tools.registrar.ts`. Model kecil / open-weights kini bisa mengedit banyak bagian berbeda di file apapun dalam 1 kali panggil tool tanpa perlu menghitung baris unified diff yang rumit.
3. **Robust Parameter Synonyms & Fallback Extraction**: Menambahkan toleransi alias parameter (`patch`, `diff`, `search`, `target`, `replace`, `changes`, `edits`, dll.) dan auto-fallback ke `extractAndApplyFallback` jika derive diff gagal.
4. **Clean Tool Output Previews**: Menyederhanakan preview pesan sukses `edit` menjadi konfirmasi ringkas dan jelas (*saved to disk*) tanpa mendump 1500 karakter dokumen kembali ke conversation, mencegah model kecil mengalami halusinasi atau mengulang round edit yang berlebihan.
5. **Cost Optimization & Sub-30s Performance (`gpt-oss-120b`)**: Mengoptimalkan eksekusi model ekonomis `gpt-oss-120b` di Kenari (biaya ~Rp 3 - 5 per request vs Rp 30 - 70 pada model mahal) agar menyelesaikan seluruh pengeditan file dalam 1 putaran di kisaran **~25–30 detik**.

## Files Changed
- `apps/api/src/prompts/rules.md` — Prinsip universal format-agnostic document preservation.
- `apps/api/src/prompts/chat-rules.md` — Aturan chat yang agnostik terhadap jenis file bisnis user.
- `apps/api/src/modules/tools/services/edit-tool.service.ts` — Dukungan multi-replacement array, parameter synonyms, fallback extraction, dan clean preview format.
- `apps/api/src/modules/tools/services/registrars/workspace-file-tools.registrar.ts` — Update skema parameter `edit` dengan properti `replacements`.
- `apps/api/src/modules/tools/services/patch-healer.ts` — Auto-healer diff malformed dan fallback chunk extractor.
- `apps/api/src/modules/tools/services/apply-patch.ts` — Toleransi prefix spasi dan dual search fallback.
- `apps/api/scripts/set-model.ts` — CLI utility untuk switch model Kenari.
- `apps/api/scripts/list-models.ts` — CLI utility untuk melihat model aktif dan daftar provider.

## Tests
- `npx vitest run apps/api/src/modules/tools/services/apply-patch.spec.ts` — ✅ 7/7 passed
- `gpt-oss-120b` Autonomous Document Execution Test — ✅ Round 1 tool executed in 25.7s, edit applied cleanly with 0 errors.

## Status
✅ PASS, VERIFIED, & COMMITTED
