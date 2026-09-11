# Dev Log — Verify 10 Turns E2E Chat & Watchdog Isolation

**Date & Time:** 2026-09-11 12:05:00 WIB  
**Author:** AI Software Engineer (Antigravity)

## What
Dilakukan pengujian end-to-end (E2E) otomatis sebanyak 10 giliran percakapan (*10 conversational turns*) secara berturut-turut pada antarmuka Workstation Web (`http://localhost:5173/?directory=E%3A%5CREKAPAN`) tanpa reload manual halaman browser.

Dalam pengujian multi-turn berkelanjutan ini, ditemukan potensi race condition pada lifecycle watchdog per giliran:
1. **Watchdog Leak**: Timer watchdog 90 detik dari turn sebelumnya yang belum sempat di-clear dapat terpicu pada turn berikutnya, menyebabkan `abortCtrl.abort()` tak sengaja mematikan turn aktif.
2. **SSE Reader Cleanup**: Koneksi pembaca event SSE pada client perlu ditutup secara eksplisit via `abortCtrl.abort()` dengan sedikit jeda (300ms) setelah finalisasi berhasil (`finalizeDone`), mencegah akumulasi pembaca listener gantung.
3. **OpenAI Protocol Tool Finish Reason**: Pada skenario penanganan event chunking, chunk dengan tool call memerlukan penentuan status `tool-calls` secara konsisten terlepas apakah `finish_reason` dari provider bernilai null atau string lain.

## Files Changed
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts`:
  - Menambahkan `currentTurnIdRef = useRef<string>("")` untuk membedakan giliran aktif.
  - Memastikan watchdog lama di-clear dan controller aktif sebelumnya di-abort saat giliran baru dikirim.
  - Mengabaikan callback atau timeout yang berasal dari turn ID lama (`if (currentTurnIdRef.current !== assistantMessageId) return;`).
  - Menutup `abortCtrl` secara elegan setelah `finalizeDone()`.
- `packages/engine/llm/src/protocols/openai-chat.ts`:
  - Menyelaraskan `finishEvents()`: `const reason = hasToolCalls ? "tool-calls" : (state.finishReason ?? "stop")`.
- `WORKFLOW.md`:
  - Menambahkan dokumentasi Phase 76.

## Verification & Tests
- **Automated Playwright 10-Turn E2E Suite** (`test-10-turns-e2e.mjs`):
  - **Turn 1/10**: *"Halo Arunaki! Siapa kamu dan apa fungsi utamamu?"* ➔ Finalized in 3.0s (Pass)
  - **Turn 2/10**: *"Apa kepanjangan dari SOP dalam administrasi perkantoran?"* ➔ Finalized in 13.1s (Pass)
  - **Turn 3/10**: *"Sebutkan 3 format file dokumen yang umum digunakan untuk laporan kerja"* ➔ Finalized in 4.0s (Pass)
  - **Turn 4/10**: *"Apa rumus dasar Excel untuk menghitung rata-rata nilai dari sel B1 sampai B10?"* ➔ Finalized in 7.0s (Pass)
  - **Turn 5/10**: *"Tuliskan contoh subjek email resmi untuk permohonan izin cuti tahunan"* ➔ Finalized in 6.0s (Pass)
  - **Turn 6/10**: *"Apa kepanjangan dari KPI dalam manajemen kinerja karyawan?"* ➔ Finalized in 5.0s (Pass)
  - **Turn 7/10**: *"Sebutkan 3 komponen utama dalam laporan keuangan perusahaan"* ➔ Finalized in 4.0s (Pass)
  - **Turn 8/10**: *"Apa fungsi utama dari kop surat pada dokumen dinas atau resmi?"* ➔ Finalized in 13.1s (Pass)
  - **Turn 9/10**: *"Sebutkan 3 jenis lampiran yang umum disertakan dalam surat penawaran harga"* ➔ Finalized in 5.0s (Pass)
  - **Turn 10/10 (Context Synthesis)**: *"Terima kasih Arunaki! Tolong rangkum dalam 3 poin singkat apa saja yang sudah kita bahas dalam percakapan ini"* ➔ Finalized in 11.1s (Pass), sukses merangkum poin SOP, formula Excel, KPI, dokumen dinas, dan laporan keuangan dari riwayat percakapan sebelumnya.
  - **Hasil**: 10/10 turns PASSED, exit code 0.
- **Frontend Build**:
  - `npm run build -w apps/web` ➔ 0 compilation errors.

## Notes & Hygiene
- Scratch test scripts disimpan di luar direktori source code kerja (`.gemini/antigravity-ide/brain/.../scratch/`) sehingga tidak mengotori git tree.
- Status UI browser tetap responsif, tombol kirim selalu kembali ke status `ready`, dan riwayat obrolan tersimpan utuh di SQLite backend.
