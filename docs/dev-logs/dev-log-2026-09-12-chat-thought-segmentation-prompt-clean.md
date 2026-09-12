# Dev Log — Chat Thought Segmentation & Prompt Hygiene

**Date & Time:** 2026-09-12 18:07:30 WIB
**Author:** AI Software Engineer

## What
1. **System Prompt Clean & Generalization**:
   - Dihapus contoh spesifik workspace/nama file lokal (`REKAPAN TERBARU2.txt`, transaksi spesifik `CK CIPTA`) dari `default.txt`.
   - Diganti menjadi instruksi generic dokumen & data agent: dokumen dibaca/diubah dengan tool dokumen resmi (`read`, `excel_read`, `edit`, `write`), dilarang menjalankan looping python/shell script, serta dilarang mengeksekusi tool untuk query casual/ambiguous.
2. **Chat Message Thought Segmentation & Grouping**:
   - Di `useWorkstationChat.ts`: Thought per step streaming dicatat dengan durasi individual per langkah (`currentStepReasoningStart`), mencegah penggabungan durasi total 287s ke dalam satu badge raksasa saat `finalizeDone`.
   - Di `ChatMessageBubble.tsx`: Dikelompokkan tool yang berurutan secara kontigu ke dalam satu grup card, sementara tiap blok thought dan teks respons dirender terpisah secara berurutan.
   - Kepatuhan total terhadap React Rules of Hooks (semua hooks dideklarasikan di bagian atas sebelum early return).

## Files Changed
- `packages/engine/engine/src/session/prompt/default.txt` — Generalisasi aturan tanpa hardcode contoh lokal
- `apps/web/src/components/workstation/chat/ChatMessageBubble.tsx` — Part grouping & sequential step rendering
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Per-step thought duration & isolation

## Tests & Verification
- `npm run build -w apps/web` — ✅ Passed (Exit Code 0, 0 TypeScript errors)
- `git status --porcelain` — Clean workspace

## Notes
- Workspace default prompt sekarang sepenuhnya universal dan aman untuk semua jenis dokumen.
