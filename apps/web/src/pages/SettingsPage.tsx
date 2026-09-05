import { useState, useEffect } from "react";
import { Cpu, User, Sliders } from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch, directoryQuery } from "../lib/api";
import { ModelProviderSettings, Provider } from "../components/settings/ModelProviderSettings";
import { SettingsAccountTab } from "../components/settings/SettingsAccountTab";
import { SettingsAutomationTab } from "../components/settings/SettingsAutomationTab";

const tabs = [
  { id: "models", label: "Model Routing & Providers", icon: Cpu },
  { id: "account", label: "Account & License", icon: User },
  { id: "integrations", label: "Desktop Automation & Behavior", icon: Sliders },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("models");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    try {
      // Query active engine endpoints: /api/provider and /api/model
      const [providerRes, modelRes] = await Promise.all([
        apiFetch(`${API_BASE}/provider${directoryQuery()}`),
        apiFetch(`${API_BASE}/model${directoryQuery()}`),
      ]);

      if (providerRes.ok) {
        const pJson = await providerRes.json();
        const mJson = modelRes.ok ? await modelRes.json() : { data: [] };
        const rawProviders: any[] = pJson.data || [];
        const rawModels: any[] = mJson.data || [];

        if (rawProviders.length > 0) {
          const mapped: Provider[] = rawProviders.map((p: any, idx: number) => {
            const associatedModels = rawModels.filter((m: any) => m.providerID === p.id);
            const modelNames = associatedModels.map((m: any) => m.id).join(", ") || "default";
            const maskedKey = p.request?.body?.apiKey
              ? `${p.request.body.apiKey.slice(0, 5)}••••••••`
              : "Configured";
            return {
              id: p.id,
              name: p.name || p.id,
              type: p.api?.type || "openai-compatible",
              baseUrl: p.api?.url || "",
              apiKey: maskedKey,
              model: modelNames,
              active: true,
              priority: idx + 1,
            };
          });
          setProviders(mapped);
          return;
        }
      }

      // Fallback to legacy endpoint if available
      const legacyRes = await apiFetch(`${API_BASE}/providers${directoryQuery()}`);
      if (legacyRes.ok) {
        const data = await legacyRes.json();
        setProviders(data.data || []);
      } else {
        setProviders([]);
      }
    } catch (err) {
      console.error("Failed to fetch providers:", err);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-y-auto select-none p-6 transition-colors duration-150">
      <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col min-h-0">
        {/* Header Title */}
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Workstation & System Settings
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Configure model routing, user accounts, license tiers, and desktop automation behavior.
          </p>
        </div>

        {/* Tab Navigation Pill Bar (Monochrome) */}
        <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3 mb-6 overflow-x-auto shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer border",
                  isActive
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-xs"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Settings Panel Content */}
        <div className="flex-1 w-full bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-color)] p-6 overflow-y-auto min-h-0 transition-colors duration-150">
          {activeTab === "models" && (
            <ModelProviderSettings
              providers={providers}
              loading={loading}
              onRefresh={fetchProviders}
            />
          )}

          {activeTab === "account" && <SettingsAccountTab />}

          {activeTab === "integrations" && <SettingsAutomationTab />}
        </div>
      </div>
    </div>
  );
}
