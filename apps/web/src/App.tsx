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

// Self-healing migration: sanitize and heal model & provider configuration on app launch
if (typeof window !== "undefined") {
  try {
    if (!localStorage.getItem("arunaki_active_provider")) {
      localStorage.setItem("arunaki_active_provider", "kenari");
    }

    const kenariPool = localStorage.getItem("arunaki_provider_models_kenari");
    if (
      !kenariPool ||
      kenariPool.includes("glm-4-7-flash:free") ||
      !kenariPool.includes("agnes-2-0-flash:free") ||
      kenariPool.includes("mistral-large:free") ||
      kenariPool.includes("muse-spark") ||
      kenariPool.includes("kimi") ||
      kenariPool.includes("lightning") ||
      kenariPool.includes("tiny") ||
      kenariPool.includes("longcat") ||
      kenariPool.includes("north-mini")
    ) {
      const verified = [
        "agnes-2-0-flash:free",
        "mistral-medium-3-5:free",
        "nemotron-3-super-120b-a12b:free",
        "step-3-7-flash:free",
        "mimo-v2-5:free",
      ];
      localStorage.setItem("arunaki_provider_models_kenari", verified.join(", "));
    }

    const activeModel = localStorage.getItem("arunaki_active_model");
    if (
      !activeModel ||
      activeModel.includes(",") ||
      activeModel === "glm-4-7-flash:free" ||
      activeModel === "mistral-large:free" ||
      activeModel.includes("muse-spark")
    ) {
      localStorage.setItem("arunaki_active_model", "agnes-2-0-flash:free");
    }
  } catch {}
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

