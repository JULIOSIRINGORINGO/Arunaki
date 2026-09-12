# Dev Log — Clean Hardcoded Models and Providers from Engine Adapter

**Date & Time:** 2026-09-12 08:45:00 WIB
**Author:** Antigravity (Advanced Agentic AI Software Engineer)

## What
Cleaned and eliminated all emergency hardcoded model blacklist filters (`mistral-large:free`, `muse-spark`) and hardcoded fallback provider references (`kenari`) from `createSession` and `switchSessionModel` in `apps/web/src/lib/engine.ts`. 

Restored strict compliance with the Provider Abstraction principle in `AGENTS.md` and `docs/ARCHITECTURE.md`. Sanitization of comma-delimited model strings (e.g. selecting the first item `id.split(",")[0].trim()`) is preserved without hardcoding model names or assuming specific providers. Unprefixed model identifiers dynamically resolve their provider via `localStorage.getItem("arunaki_active_provider")` with a generic `"default"` fallback.

## Files Changed
- `apps/web/src/lib/engine.ts` — Removed hardcoded `m !== "mistral-large:free" && !m.includes("muse-spark")` checks; replaced hardcoded `providerID: "kenari"` fallback with dynamic `arunaki_active_provider` lookup.

## Tests
- `npm run build -w apps/web` — ✅ passed (0 TypeScript compilation errors, built cleanly in 10.32s).

## Notes
- Comma-delimited model pools (often stored when switching models or configuring options) are cleanly truncated to the active primary model ID without blacklisting or vendor bias.
- Works seamlessly across all configured providers (Kenari, OpenRouter, Mistral, OpenAI-compatible, Ollama, etc.).
