import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
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

export default function App() {
  const { theme } = useTheme();
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster 
        theme={effectiveTheme as 'light' | 'dark'} 
        position="bottom-center" 
        toastOptions={{
          className: 'dark:!bg-[#1C1C1F]/90 dark:!text-[#F4F4F5] dark:!border-[#2E2E35] !bg-white/90 !text-[#111827] !border-[#E5E7EB] !rounded-full !shadow-[0_8px_30px_rgb(0,0,0,0.12)] !px-5 !py-3 !text-[12px] !font-medium tracking-tight backdrop-blur-md',
          duration: 3000,
        }}
      />
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
    </QueryClientProvider>
  );
}

