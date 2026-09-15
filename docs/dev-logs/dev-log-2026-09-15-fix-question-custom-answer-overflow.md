# Dev Log — Fix Question Prompt Custom Answer Text Overflow

**Date & Time:** 2026-09-15 12:47:00 WIB  
**Author:** AI Software Engineer  

## What
Memperbaiki bug layout pada tampilan kartu pertanyaan saat status *answered* (`QuestionPromptCard.tsx`):
- Ketika pengguna memasukkan jawaban kustom yang panjang, sebelumnya teks jawaban memanjang secara horizontal dan menembus pembungkus (*container card*) karena menggunakan layout horizontal `flex items-center justify-between` dengan `shrink-0` tanpa styling text wrapping (`break-words`/`whitespace-normal`).
- Memperbaiki tata letak kartu jawaban dengan menyusun teks pertanyaan di atas dan kotak jawaban di bawah secara rapi dalam format `flex flex-col gap-2 min-w-0`.
- Menambahkan styling `max-w-full`, `break-words`, `whitespace-pre-wrap`, `leading-relaxed`, dan `[overflow-wrap:anywhere]` pada badge/kotak jawaban agar teks jawaban turun ke baris berikutnya (*wrap downward*) dan tetap berada di dalam batas kartu.
- Menambahkan `min-w-0` pada kontainer utama kartu dan elemen form input kustom agar tidak memicu horizontal overflow pada container chat.

## Files Changed
- `apps/web/src/components/workstation/chat/QuestionPromptCard.tsx` — Memperbaiki layout `isAnswered` dan wrapping teks jawaban kustom serta pertanyaan.

## Tests & Verification
- `npm run build -w apps/web` — ✅ Passed with 0 TypeScript/Vite bundling errors.
- Visual inspection via Puppeteer screenshot di sesi riil pengguna (`ses_f5c704907ffejc6ewx87ffGWdq`):
  - Screenshot `answered_card_1.png` memverifikasi jawaban panjang:
    `"ganti judulnya aja, data yang lama jangan geser data baru nanti mengikuti judul yang udah ada"`
    berhasil turun ke 3 baris secara rapi di dalam kotak kartu tanpa ada teks yang menembus border.
