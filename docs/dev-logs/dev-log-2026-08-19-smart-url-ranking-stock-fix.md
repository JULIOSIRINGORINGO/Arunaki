# Dev Log — Smart URL Ranking + Stock Lookup Fix

**Date & Time:** 2026-08-19 17:00 WIB
**Author:** opencode/big-pickle

## What

Fixed two critical issues in the stock lookup E2E flow:

1. **Knowledge context URL truncation** — `searchNodes()` was injecting ALL 50+ product URLs into LLM context (4898 chars), which got truncated to 1200 chars by `injectionMaxChars`. LLM never saw the correct product URL and used the base URL instead.

2. **stock_lookup browser fallback** — `httpRows ?? []` operator didn't trigger browser fallback when HTTP returned empty array (only triggers on null/undefined).

## Files Changed

- `apps/api/src/modules/knowledge/knowledge.service.ts` — Added generic `rankUrls()` method that scores URLs against user query tokens (path segments + query param values). Only top 15 relevant URLs injected. Works for any e-commerce site structure.
- `apps/api/src/modules/ai/context-manager.ts` — Adjusted `injectionMaxChars` from 1200 → 2000 (URL ranking makes this feasible).
- `apps/api/src/modules/tools/services/stock-lookup.tool.ts` — Line 125: `httpRows ?? []` → `httpRows?.length ? httpRows : await this.lookupViaBrowser(located)` to correctly trigger browser fallback on empty array.
- `apps/api/src/modules/interaction/browser-interaction.service.ts` — `headless: false` → `headless: true`.
- `apps/api/src/modules/knowledge/services/crypto-harvester.service.ts` — PrismaService injection, OnModuleInit loads learned sites from `memories` table, `learnFromCaptures` persists encryption keys to DB.
- `apps/api/src/modules/knowledge/services/crypto-harvester.service.spec.ts` — Updated with mock PrismaService, all tests made async.

## Tests

- E2E stock lookup: "cek stok NSA Polo Easy Care Daisy S4 di cititex" → correct product URL used, real stock data returned (Daisy S=79, M=101, L=59, XL=72, 2XL=68, 3XL=0), Source citation present.
- Knowledge context: `2087 → 2000 chars` (was `4898 → 1200 chars`).
- URL ranking: generic, works for any e-commerce URL structure.

## Notes

- `injectionMaxChars` set to 2000 — sufficient for ranked URLs + node content. Can increase if nodes grow.
- CryptoHarvester DB persistence verified: manually inserted test entry → restart → loaded from DB → cleaned up.
- Kenari/DeepSeek provider intermittently slow (117s+ responses). Not a code issue.
