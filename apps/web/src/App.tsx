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
          className: 'dark:!bg-[#1C1C1F]/80 dark:!text-[#F4F4F5] dark:!border-[#323232] !bg-white/80 !text-[#111827] !border-[#E5E7EB] !rounded-full !shadow-md !px-3.5 !py-1.5 !text-[11px] !font-medium tracking-wide backdrop-blur-md !w-auto !max-w-fit !mx-auto !min-h-0 flex items-center gap-1.5',
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

