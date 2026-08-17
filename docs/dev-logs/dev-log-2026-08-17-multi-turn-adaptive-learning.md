# Dev Log — Multi-Turn Adaptive Learning & Format Consistency

**Date & Time:** 2026-08-17 21:30:00 WIB  
**Author:** Antigravity (AGY)

## What
Verified the **Human-in-the-loop Multi-Turn Adaptive Learning** capability of Arunaki. Users never need to write prompt engineering rules or manual markdown configuration files. When a user corrects or teaches a format in conversational natural language, Arunaki's living memory & Sentinel dynamically assimilate the preference into `ARUNAKI.md` and conversation context.

### Tested Workflows:
1. **Garment / Konveksi Domain**:
   - Taught size format (`UKURAN`, `S`, `M`, `L`, `XL`, `2XL`, `3XL`, `TOTAL [N] PCS`, `XXL -> 2XL`).
   - Verified on unseen order (`tono l, andi m, fajar xl, bayu s, reza xxl, dito m, dimas 2xl, rio s`) $\rightarrow$ Perfect adherence in `[CANVAS]`.
2. **Bakery / Toko Kue Domain**:
   - Taught custom ledger format (`REKAP PESANAN KUE`, `- [Nama Kue] : [Jumlah] [Satuan]`, `TOTAL ITEM: [Total] BOX/TOPLES/LOYANG`).
   - Verified on unseen order (`bu sarah roti sobek 4 box, pak hendra nastar 2 toples, bu tari lapis legit 1 box`) $\rightarrow$ Perfect adherence in `[CANVAS]` with exact item counts and total 7.

## Tests
- `npx tsx scripts/test-multi-turn-adaptive-learning.ts deepseek-v4-flash` — ✅ **Passed 100% across all domains & turns**.
