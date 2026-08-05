# Dev Log — 2026-08-05 — Token-Based Compaction (Gap #14, #15)

## Context
Audit part 2 temuan #14-15: Compaction engine memicu berdasarkan jumlah pesan (bukan token) yang bisa memicu context overflow pada sesi panjang, dan `compactWithLLM` rentan overflow input.

## Changes

### 1. Token-Based Compaction Trigger (#14)
- Gate `messages.length > 20` di `workspace-runner.service.ts` dihapus.
- `CompactionService.compactHistory` sekarang menghitung total token (menggunakan `countTokens`) dan memicu compaction jika > 60k tokens.
- Split `recentMessages`/`olderMessages` sekarang berbasis token (`RECENT_TOKENS_BUDGET` = 24k tokens), bukan fixed-count 10 messages.

### 2. LLM Summary Input Capping (#15)
- `compactWithLLM` menambahkan capping pada `olderTexts` ke `MAX_SUMMARY_INPUT_TOKENS` (30k tokens).
- Truncation dilakukan per-pesan agar tidak memotong tengah kalimat/token di tengah-tengah.
- Log fallback ke `compactWithSummary` lebih deskriptif ("LLM summary gagal... FALLBACK ke COMPACTION SUMMARY").

## Verification Results

### Automated Tests
- `compaction.service.spec.ts` baru (5 test):
  - No compaction under 60k tokens.
  - Token-based trigger works; summary generated.
  - Oversized tail message correctly preserved by >= 2 recent-message guard.
  - Input truncation cap works for large history (input to LLM ≤ 30k tokens).
  - LLM fallback robust when LLM call fails.
- Full suite `npm run test` pass (139/139).
