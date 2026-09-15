# Dev Log — Fix Question Continuation UI State & Indicator Delay

**Date & Time:** 2026-09-15 12:55:40 WIB  
**Author:** AI Software Engineer  

## What
Memperbaiki delay dan hilangnya indikator status aktif (tombol kirim kembali ke warna hitam, status hening tanpa tanda sedang memproses) setelah pengguna mengirimkan jawaban pada kartu pertanyaan (*clarification question*):
1. **Penyebab Utama**:
   - Sebelumnya, `handleAnswerQuestion` di `useWorkstationChat.ts` menggunakan polling interval 800ms yang mengecek `const hasContinuation = questionMsgIdx >= 0 && mapped.length > questionMsgIdx + 1;` menggunakan `mapped.findIndex(...)`. Pada sesi obrolan yang memiliki riwayat pesan panjang atau lebih dari satu pertanyaan, kondisi ini langsung bernilai `true` di tick pertama (setelah 800ms) atau berhenti setelah 15 tick (12 detik).
   - Akibatnya, `setStreamingState(false)` dan `setLiveStatus(null)` langsung terpanggil terlalu dini, mematikan status streaming dan menyembunyikan tombol merah sebelum LLM selesai berpikir (*reasoning time* 14+ detik).
2. **Perbaikan yang Dilakukan**:
   - **Continuation Streaming**: Menambahkan langganan event SSE (`subscribeEvents`) di dalam `handleAnswerQuestion` dengan `continuationAssistantId` optimistik, sehingga delta penalaran (*reasoning*), eksekusi tool nyata, dan teks jawaban mengalir secara *real-time*.
   - **Active Session Polling**: Menggunakan endpoint engine `/api/session/active` untuk memantau status eksekusi sesi secara akurat (`running` -> `idle`) dan hanya menyelesaikan state streaming ketika engine benar-benar selesai.
   - **UI Stop Button Enhancement**: Tombol stop merah di `ChatInputBox.tsx` kini dilengkapi ring spinner berputar halus (`border-2 border-red-400 border-t-transparent animate-spin`) yang tetap aktif berwarna merah dan berputar sepanjang proses kelanjutan.
   - **Question Card Header Indicator**: Header kartu pertanyaan yang telah dijawab kini menampilkan badge `Processing...` dengan animasi spinner `Loader2` saat `isStreaming` aktif, dan berubah menjadi `Answered` setelah selesai.
   - **Session Interruption Support**: Menambahkan fungsi `interruptSession(sessionId)` di `apps/web/src/lib/engine.ts` yang dipanggil saat pengguna menekan tombol stop merah untuk menghentikan proses eksekusi di server.

## Files Changed
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts`
- `apps/web/src/components/workstation/chat/ChatInputBox.tsx`
- `apps/web/src/components/workstation/chat/QuestionPromptCard.tsx`
- `apps/web/src/components/workstation/chat/ChatMessageBubble.tsx`
- `apps/web/src/lib/engine.ts`

## Tests & Verification
- `npm run build -w apps/web` — ✅ Passed with 0 errors (TypeScript & Vite production build).
