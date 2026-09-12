import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { AppLayout } from "./components/layout/AppLayout";
import { UnifiedWorkstationPage } from "./pages/UnifiedWorkstationPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { useTheme, getSystemTheme } from "./lib/theme";
import { DEFAULT_MODELS } from "./components/settings/constants";
import { API_BASE, apiFetch, directoryQuery } from "./lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
    },
  },
});
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const RouterComponent = isFileProtocol ? HashRouter : BrowserRouter;

// Auto-refresh model catalog from API on app launch (fire-and-forget, non-blocking).
// Dead/discontinued models automatically disappear because the API only returns live models.
async function refreshModelCatalog() {
  try {
    const res = await apiFetch(`${API_BASE}/providers${directoryQuery()}`);
    const data = await res.json();
    const providers: Array<{ id?: string; baseUrl?: string; apiKey?: string; model?: string }> =
      data?.data || data || [];

    for (const p of providers) {
      if (!p.id || !p.baseUrl) continue;
      try {
        const modelsRes = await apiFetch(`${API_BASE}/providers/fetch-models${directoryQuery()}`, {
          method: "POST",
          body: JSON.stringify({ baseUrl: p.baseUrl, apiKey: p.apiKey }),
        });
        const modelsData = await modelsRes.json();
        const models: string[] = (modelsData?.data?.models || []).filter(Boolean);
        if (models.length > 0) {
          localStorage.setItem(`arunaki_provider_models_${p.id}`, models.join(", "));
        }
      } catch { /* single provider fail — skip, don't break loop */ }
    }

    // Validate active model still exists in its provider's catalog
    const activeProvider = localStorage.getItem("arunaki_active_provider") || "kenari";
    const activeModel = localStorage.getItem("arunaki_active_model");
    const pool = localStorage.getItem(`arunaki_provider_models_${activeProvider}`);
    if (activeModel && pool && !pool.split(",").map((s) => s.trim()).includes(activeModel.trim())) {
      const first = pool.split(",").map((s) => s.trim()).filter(Boolean)[0];
      if (first) localStorage.setItem("arunaki_active_model", first);
    }
  } catch { /* offline or API unavailable — keep cached localStorage values */ }
}

if (typeof window !== "undefined") {
  // Ensure default provider is set
  if (!localStorage.getItem("arunaki_active_provider")) {
    localStorage.setItem("arunaki_active_provider", "kenari");
  }
  // Ensure default active model for first-time users
  if (!localStorage.getItem("arunaki_active_model")) {
    localStorage.setItem("arunaki_active_model", (DEFAULT_MODELS.kenari || [])[0] || "deepseek-v4-flash");
  }
  // Fire-and-forget: refresh catalog from API (non-blocking)
  refreshModelCatalog();
}

export default function App() {
  const { theme } = useTheme();
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster 
        theme={effectiveTheme as 'light' | 'dark'} 
        position="top-center" 
        offset="52px"
        visibleToasts={1}
        toastOptions={{
          className: 'dark:!bg-[#1C1C1F]/90 dark:!text-[#F4F4F5] dark:!border-[#323232] !bg-white/90 !text-[#111827] !border-[#E5E7EB] !rounded-full !shadow-none !px-4 !py-2 !text-[11px] !font-medium tracking-wide backdrop-blur-md flex items-center gap-2 justify-center border',
          duration: 3000,
        }}
      />
      <ErrorBoundary fullScreen fallbackTitle="Workstation encountered an unexpected error">
        <RouterComponent>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<UnifiedWorkstationPage />} />
              <Route path="/workspace" element={<Navigate to="/" replace />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </RouterComponent>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

