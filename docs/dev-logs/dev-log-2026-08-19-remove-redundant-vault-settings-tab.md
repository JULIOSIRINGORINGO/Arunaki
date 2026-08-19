# Dev Log — Simplify Settings Menu (Remove Redundant Vault Tab)

**Date & Time:** 2026-08-19 17:17:30 WIB
**Author:** Antigravity AI

## What
Removed the redundant `Security & Vault` tab from the Settings page to eliminate developer jargon and avoid duplicate credential management. Since the **Knowledge Graph** already manages all live web fetching, URLs, and documentation without manual API keys, having a separate secrets vault was unnecessary for users.

### Updated Settings Architecture:
1. **AI Models** — LLM Providers & Core Model Selection.
2. **Profile & Persona** — Display Name, Persona (Analyst/Standard/Executive), and Response Language.
3. **Desktop Integrations** — Native Desktop Shell Bridge, Excel, Word & PDF engine status.
4. **Workspace & Storage** — Active Workspace Directory, Security Isolation Sandbox, and Manual Resync.

## Files Changed
- `apps/web/src/pages/SettingsPage.tsx`

## Tests
- `npm run build -w apps/web` — ✅ passed (0 errors, 2200 modules transformed)
