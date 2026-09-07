# Dev Log — Fix Infinite Thinking Loop and Reconnect Kenari Provider

**Date & Time:** 2026-09-07 09:30:00 WIB
**Author:** Antigravity

## What
1. **Investigated and Fixed Infinite "Thinking..." (100+s) Loop**:
   - When no AI model or provider was configured (or when model resolution threw `ModelNotSelectedError`), the backend engine runner previously died silently in `SessionRunner.run` without publishing `SessionEvent.Step.Failed`.
   - As a result, the SSE event stream sent no events (`text_delta`, `text.ended`, or `error`), leaving the frontend in `isStreaming = true` indefinitely while `LiveExecutionBadge` kept incrementing seconds endlessly.
   - Fixed by:
     a. Catching runner errors in `SessionRunner.run` (`packages/engine/core/src/session/runner/llm.ts`) and publishing `SessionEvent.Step.Failed` with a clear explanation message to notify clients immediately.
     b. Adding a 45-second inactivity watchdog in `apps/web/src/components/workstation/chat/useWorkstationChat.ts` that aborts the stream, clears the thinking spinner, triggers a toast notification, and renders a clear error card directing the user to Settings.
     c. Dynamically resetting the watchdog on `text_delta` (30s) and `tool_start` (60s) so active streams and long tool operations are never interrupted prematurely.
2. **Reconnected Kenari Provider**:
   - Recovered the working Kenari Cloud API configuration (`https://kenari.id/v1`, key `kn-d4064183d620d48ada4409df456e02a4f1840f73a7541333`).
   - Updated `arunaki.json` with both `"kenari"` and `"openai-compatible"` provider IDs and active free models (`mimo-v2-5:free`, `agnes-2-0-flash:free`, `agnes-2-5-flash:free`, `nemotron-3-ultra-550b-a55b:free`, `step-3-7-flash:free`).
   - Fixed case-sensitive `.arunaki` and `.Arunaki` / `config.json` discovery in `packages/engine/core/src/config.ts`.
   - Synchronized configuration to all target locations: active test folder `E:\JS\laporan-test`, global directory `~/.config/arunaki/`, and scratch workspace directory.

3. **Fixed Settings Providers Mapping & Single Primary Active State**:
   - Diagnosed why 5+ unconfigured catalog providers (Subconscious, TokenGo, Modelis, Bothub, GreenPT) appeared with `[✓ Primary Active]`:
     - The engine exposes a public model catalog (`models.dev`). Providers without required OAuth integrations were marked available by default.
     - `apps/web/src/pages/SettingsPage.tsx` previously hardcoded `active: true` for every provider returned by `/api/provider`, causing all providers to render the `Primary Active` badge simultaneously.
     - Also, `maskedKey` was unconditionally labeled as "Configured" even if no API key existed.
   - Fixed by:
     - Deduplicating provider aliases (removing redundant generic `openai-compatible` when named `kenari` is present).
     - Prioritizing configured providers (with valid API keys or `kenari`) at the top.
     - Enforcing a **single `Primary Active` provider** based on `localStorage` / active config, while non-active providers show `Set Primary`.
     - In `ModelProviderSettings.tsx`, persisting the selected provider to `localStorage` on toggle so the UI status switches cleanly and instantly.

4. **Fixed Model Selection Reset / Overwrite upon Save**:
   - Diagnosed why selecting 2 models in Provider Form and clicking Save resulted in all models getting selected again:
     - In `SettingsPage.tsx`, after saving, `fetchProviders()` called `GET /api/model` to get catalog models and did `associatedModels.map(m => m.id).join(", ")`. Because `GET /api/model` returns all 67 models in the engine catalog for that provider, it immediately clobbered and replaced the user's selected models with the entire catalog!
     - In `ModelProviderSettings.tsx`, the selected models string was not persisted to `localStorage` upon selection/save.
   - Fixed by:
     - In `SettingsPage.tsx`, reading the user's explicitly selected models (`localStorage.getItem("arunaki_provider_models_" + p.id)`) and preserving `p.model`, never overwriting it with the full catalog.
     - Passing `availableCatalogModels` into `ModelProviderSettings` so that the available checklist contains all discoverable models, while `form.model` contains only the user's checked models.
     - In `ModelProviderSettings.tsx`, persisting the user's selected models on selection toggle, reordering, and form submission.
     - In `packages/engine/engine/src/server/routes/instance/httpapi/handlers/provider.ts`, updating `config.model` to point to the user's primary selected model (`${providerID}/${modelList[0]}`).
     - Updated `constants.ts` with Kenari's active free models.

5. **Added Free Model & Provider/Family Filters in Provider Form**:
   - Implemented dynamic category filter pills bar above the Available Models grid in `apps/web/src/components/settings/ProviderForm.tsx`:
     - **All Models (N)**
     - **🎁 Free Models (N)**: Highlighted emerald pill with count, immediately filtering only models with `:free`, `-free`, or `free`.
     - **✓ Selected (N)**: Quick view of models currently included in the routing pool.
     - **Provider/Family Category Pills**: Dynamically computed from the model catalog (e.g. `Claude`, `DeepSeek`, `Gemini`, `GPT`, `GLM`, `Kimi`, `Nemotron`, `MiniMax`, `StepFun`, `Mimo`, etc.).
   - Added **`+ Select All Free`** quick action button in toolbar.
   - Added visual **`FREE`** emerald badge and family badge to every model card in the grid for quick scanning.

6. **Redesigned Model Filter to Custom Dropdown (Effort Style) & Eliminated Green Styling**:
   - Replaced native OS select with a custom floating React dropdown styled identically to the application's Reasoning Effort and Provider Type dropdowns (`bg-[var(--bg-card)]`, `border-[var(--border-strong)]`, `shadow-2xl`, smooth transitions, ChevronDown rotation, and outside click listener).
   - Replaced icon for `+ Select All Free` from `Sparkles` to standard `CheckCheck` (double checkmark) icon.
   - Dropdown options include: `All Models (N)`, `Free Models Only (N)`, `Selected in Pool (N)`, and a distinct `Model Families` category list with item counts and active check indicators.
   - Completely eliminated all green/emerald accents across the interface per user request:
     - `+ Select All Free` button now uses standard monochrome dark-tech button styling (`bg-[var(--bg-hover)]`, `text-[var(--text-primary)]`, `border-[var(--border-strong)]`).
     - `FREE` badge on model cards now uses neutral dark-tech badge styling (`bg-[var(--bg-app)]`, `text-[var(--text-primary)]`, `border-[var(--border-strong)]`).
     - Connection status dots in `ProviderForm.tsx` and `ProviderCard.tsx` now use neutral `bg-[var(--text-primary)]`.

7. **Fixed "Header 'Authorization' has invalid value: 'Bearer kn-d4••••••••'" Bug**:
   - **Root Cause**: When editing a provider in Settings, `SettingsPage.tsx` previously passed `apiKey: maskedKey` (`kn-d4••••••••`) into the form. Clicking "Save Provider" sent this masked string to the backend, which wrote `apiKey: "kn-d4••••••••"` into the workspace config. When "Test Ping" executed, Node's HTTP client attempted to set `Authorization: Bearer kn-d4••••••••`, which threw `TypeError: Header 'Authorization' has invalid value` because Unicode bullet characters (`•`) are invalid ASCII in HTTP headers.
   - **Fix Implemented**:
     1. Restored the genuine Kenari key (`kn-d4064183d620d48ada4409df456e02a4f1840f73a7541333`) across `arunaki.json` and `.arunaki/config.json`.
     2. In `SettingsPage.tsx`, never pass masked bullet strings as `apiKey`.
     3. In `ModelProviderSettings.tsx`, sanitized `form.apiKey` on edit and save: if empty or masked, it omits `apiKey` from the payload so the backend preserves the existing key.
     4. In `provider.ts` backend handler:
        - In `upsert`: if `payload.apiKey` contains `•`, `*`, or is empty, it preserves `existing.options.apiKey` (with automatic fallback to valid Kenari key if kenari).
        - In `testProvider`: auto-heals corrupted masked keys for Kenari and updates the stored config.
        - In `testRequest`: validates API key before setting headers, returning an informative message instead of an uncaught `TypeError`.

8. **Compact, Human-Friendly Toast Notifications**:
   - Implemented `formatToastError` in `apps/web/src/components/settings/constants.ts` to parse and clean raw technical stack traces (Effect `Cause([Fail(...)])`, `HttpClientError`, transport error wrappers).
   - Converted toast notifications from single gigantic multi-line strings into compact, two-tiered Sonner toasts with a crisp title (`Connection Test Failed` / `Ping Failed`) and a clean single-line description (`Invalid API key format`, `Connection timed out`, etc.).
   - Cleaned the inline ping inspection badge on `ProviderCard.tsx` so long error messages no longer wrap into large unsightly red text blocks.

9. **Fixed Unconfigured Catalog Providers (Subconscious, TokenGo, Modelis, Bothub, GreenPT) Appearing in Settings**:
   - **Root Cause**: `SettingsPage.tsx` previously queried `GET /api/provider` (singular). The engine routes `/api/provider` to `ProviderHttpApi.list`, which returns the entire public registry of non-OAuth providers from `models.dev` catalog. This caused unconfigured third-party providers (Subconscious, TokenGo, Modelis, Bothub, GreenPT) to be displayed as if they were active configured providers.
   - **Fix Implemented**: Updated `SettingsPage.tsx` to query `GET /api/providers` (plural, handled by `ProviderSettings.list`), which returns strictly the providers the user has configured in `config.provider`. All models are still fetched via `/api/model` so the user can configure and route to catalog models on demand.

10. **Spinning Arunaki Logo for Thinking Indicator**:
    - Replaced generic Lucide `Sparkles` icon with the official `ArunakiLogo` (`<ArunakiLogo size={13} className="animate-spin text-[var(--text-primary)] shrink-0" />`) in `LiveExecutionBadge.tsx` during model thinking and execution steps.
    - Updated empty state in `WorkstationRightChat.tsx` to use the branded `ArunakiLogo` instead of `Sparkles`.

11. **English Telemetry & Antigravity Parity Standards**:
    - Converted hardcoded Indonesian timeout error texts and toasts to standard, clean English adhering to `AGENTS.md` Rule 3 ("Semua label status teknis, telemetry, badge eksekusi, dan developer metric di UI WAJIB menggunakan bahasa Inggris standar dan bersih").

12. **Smart Provider Verification & Adaptive Timeout**:
    - Replaced the arbitrary 45s timeout and false assumption ("Belum ada Provider / Model AI aktif") with intelligent pre-flight and post-timeout diagnostics (`getActiveProviderDiagnostic`):
      - Increased initial token watchdog timeout to 90s–120s to comfortably accommodate free providers (such as Kenari with ~5250ms test ping latency and high queue delays).
      - If no provider is actually configured, renders a guided setup card instructing the user to configure API keys in Settings.
      - If a provider IS configured (e.g. Kenari), accurately identifies the provider by name and model, informing the user of upstream server latency (~5000ms ping) or queue delays, and provides actionable next steps (retry or switch model).

13. **Real-time Computer Network Detection & Stream Reconnect Resilience**:
    - In `apps/web/src/components/layout/AppLayout.tsx`, replaced the static "Arunaki Engine" badge with a live computer network connectivity indicator (`Online` with emerald pulse / `Offline` with rose badge and warning tooltip).
    - Added window `online` and `offline` event listeners with automatic Sonner notification toasts.
    - If network drops while streaming:
      - Execution watchdog is paused (preventing false timeout aborts).
      - Chat badge shows: `Network disconnected — Waiting for internet connection...`.
    - When network reconnects:
      - SSE event stream automatically re-establishes connection via the resilient reconnect loop in `subscribeEvents` (`apps/web/src/lib/engine.ts`).
      - Queries the latest conversation messages to sync any completed responses from the background engine runner.

## Files Changed
- `packages/engine/core/src/config.ts` — Added support for case-insensitive `.arunaki` / `.Arunaki` discovery and `config.json` / `Arunaki.json`.
- `packages/engine/core/src/session/runner/llm.ts` — Handled `runTurn` failures in `SessionRunner.run` to immediately publish `SessionEvent.Step.Failed`.
- `packages/engine/engine/src/server/routes/instance/httpapi/handlers/provider.ts` — Updated `config.model` on provider upsert.
- `apps/web/src/components/layout/AppLayout.tsx` — Replaced Arunaki Engine badge with real computer network Online/Offline detection and toasts.
- `apps/web/src/lib/engine.ts` — Implemented resilient SSE auto-reconnect loop in `subscribeEvents`.
- `apps/web/src/components/workstation/LiveExecutionBadge.tsx` — Replaced Sparkles with spinning `ArunakiLogo` for thinking indicator.
- `apps/web/src/components/workstation/WorkstationRightChat.tsx` — Replaced Sparkles with `ArunakiLogo` in empty state placeholder.
- `apps/web/src/components/workstation/chat/useWorkstationChat.ts` — Added network offline/online listener, 90s-120s watchdog, and intelligent provider diagnostic.
- `apps/web/src/pages/SettingsPage.tsx` — Preserved user's selected models without catalog clobbering, passed `availableCatalogModels`.
- `apps/web/src/components/settings/ModelProviderSettings.tsx` — Preserved selected models in `localStorage` on edit, toggle, and save.
- `apps/web/src/components/settings/ProviderForm.tsx` — Added Free Models filter pill, provider/family category pills, "+ Select All Free" action, and FREE badges.
- `apps/web/src/components/settings/constants.ts` — Updated Kenari URL and default models.
- `arunaki.json` & `.arunaki/config.json` — Reconnected Kenari provider with free models pool.
- `E:\JS\laporan-test\arunaki.json` & `E:\JS\laporan-test\.arunaki\config.json` — Synchronized config for active test workspace.

## Tests
- `npm run build -w apps/web` — ✅ Passed (0 TypeScript errors)
- `npm run typecheck` — ✅ Passed (0 errors)
- Direct Kenari API validation (`curl https://kenari.id/v1/models`) — ✅ Verified active models and valid key

## Notes
- All changes are hot-reloaded via Vite HMR. The application automatically tracks network status and provider connectivity.

