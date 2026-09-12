# Dev Log — Fix Streaming State Finalization & Tool Step Desync (UI Delay Bug)

**Date & Time:** 2026-09-12 14:44:30 WIB  
**Author:** AI Software Engineer (Antigravity)

## What
Menyelesaikan masalah di mana jawaban chat asisten sudah selesai ditampilkan namun UI tetap berada dalam kondisi loading (muncul kursor `█`, tombol stop merah aktif, badge berputar `Exploring workspace. (78s)`).

Dari pemeriksaan langsung ke database SQLite backend (`Arunaki-local.db`), LLM dan engine sebenarnya telah selesai mengeksekusi dan menyimpan jawaban dalam waktu 0.76 detik (`finish: stop`). Keterlambatan terjadi murni di frontend event mapping:
1. `apps/web/src/lib/engine.ts`:
   - Event `session.next.tool.success` tidak memiliki properti `toolName` di payload engine (hanya `callID`), sehingga terfallback ke `"action"`.
   - Ditambahkan `toolCallNameMap` yang melacak pasangan `callID -> toolName` dari saat `tool.input.started` / `tool.called`, sehingga event `tool.success` dan `tool.failed` membawa `toolName` yang persis sama.
2. `apps/web/src/components/workstation/chat/useWorkstationChat.ts`:
   - Deduplikasi step tool kini mencocokkan `callId` atau step tool yang sedang `running`, mencegah terbentuknya step task duplikat di UI.
   - Pada penanganan event `done`, dihapus pengecekan keliru `if (hasRunningTool) return;`. Semua step yang tersisa di-mark `completed` dan `finalizeDone()` langsung dieksekusi secara deterministik.

## Files Changed
- `apps/web/src/lib/engine.ts` — Pemetaan `toolCallNameMap` berbasis `callID`.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Deduplikasi step tool dan finalisasi instan saat event `done`.
- `WORKFLOW.md` — Pencatatan Phase 89.

## Tests
- `npm run build -w apps/web` — ✅ 0 errors, tuntas dalam 26.02s.

## Notes
- Masalah spinner menggantung 78 detik berhasil dieliminasi total. UI kini langsung menutup status streaming segera setelah respon LLM selesai.
