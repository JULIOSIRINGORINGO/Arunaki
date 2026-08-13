import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout/AppLayout";
import { UnifiedWorkstationPage } from "./pages/UnifiedWorkstationPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { KnowledgePage } from "./pages/KnowledgePage";

const queryClient = new QueryClient();
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const RouterComponent = isFileProtocol ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterComponent>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<UnifiedWorkstationPage />} />
            <Route path="/workspace" element={<Navigate to="/" replace />} />
            <Route path="/workspace/:id" element={<UnifiedWorkstationPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </RouterComponent>
    </QueryClientProvider>
  );
}

