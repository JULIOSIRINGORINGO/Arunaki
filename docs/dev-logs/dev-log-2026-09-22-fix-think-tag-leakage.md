# Dev Log — Fix Reasoning Tag Leakage (`</think>`) & Calculation Spillage

**Date & Time:** 2026-09-22 11:21:00 WIB  
**Author:** Antigravity (AI Software Engineer)

## Problem Description
Pengguna mengirimkan tangkapan layar chat di mana di bagian bawah pesan balasan asisten muncul:
```
Perhitungan:
- 2×55=110, 8×55=440, 10×55=550, 8×60=480, 2×60=120 -> 1.700RB ✓
</think>
```
Pengguna bertanya: *"ini termasuk bug ga?"* dan *"</think?"*.

## Root Cause Analysis
Ya, ini adalah bug dengan 2 aspek:
1. **Tag Reasoning Bocor ke Bubble Chat (`</think>` Leakage)**:
   - Model AI mengeluarkan tag penutup `</think>` di dalam teks jawaban (`text-0`) tanpa tag pembuka `<think>` (atau tag pembuka sudah diproses sebagai part `reasoning-0`).
   - Parser frontend di `mapper.ts` sebelumnya hanya mengecek `if (!reasoning && content.includes("<think>"))`. Karena `!reasoning` bernilai `false` (sudah ada part reasoning), dan tidak ada tag pembuka `<think>`, regex tidak dijalankan sama sekali. Tag yatim `</think>` lolos dan ter-render mentah di UI bubble chat.
   - `ChatMessageBubble.tsx` dan `ChatMessageContent.tsx` belum memiliki filter sanitasi untuk tag yatim `<\/?think\??>`.
2. **Coretan Perhitungan Bocor ke Jawaban Akhir**:
   - Model menaruh coretan matematika kasar (*scratchpad calculation*) di akhir respons teks tepat sebelum tag `</think>`, padahal sesuai aturan Arunaki (dan prinsip Minimal Typing, Maximum Automation), proses perhitungan intermediate seharusnya berada di dalam penalaran internal `<think>...</think>`, bukan dicetak ke teks obrolan pengguna kecuali diminta.

## Fixes Implemented
1. **Frontend Sanitizer (`apps/web`)**:
   - `apps/web/src/components/workstation/chat/mapper.ts`: Menambahkan fungsi `cleanReasoningTags` yang mengekstrak blok `<think>...</think>` berpasangan maupun unclosed ke dalam reasoning, serta menghapus semua tag sisa/yatim `<\/?think\??>` dari `content` dan setiap chunk teks.
   - `apps/web/src/components/workstation/chat/ChatMessageBubble.tsx`: Menyaring sisa tag `<\/?think\??>` pada `displayContent` dan `fullText`.
   - `apps/web/src/components/workstation/chat/ChatMessageContent.tsx`: Membersihkan `<\/?think\??>` pada `parseContentBlocks`.
2. **Backend Engine (`packages/engine`)**:
   - `packages/engine/engine/src/session/processor.ts`: Membersihkan tag `<\/?think\??>` pada saat event `text-end` sebelum teks disimpan ke SQLite database.
   - `packages/engine/engine/src/session/system.ts`: Mempertegas aturan bahwa perhitungan perantara (*intermediate math*) dan tag `</think>` dilarang keras dicetak di respons akhir pengguna.
   - `packages/engine/engine/src/session/prompt/default.txt`: Menambahkan instruksi ketat isolasi kalkulasi ke dalam blok `<think>...</think>`.

## Verification
- Frontend build `npm run build -w apps/web`: ✅ Passed (0 error kompilasi).
- Pemeriksaan database record: Berhasil mengidentifikasi pesan terkait dan memastikan filter sanitasi menghapus `</think>`.
