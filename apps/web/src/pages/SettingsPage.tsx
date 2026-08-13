import { useState, useEffect } from "react";
import { User, Brain, Puzzle, Shield, Database } from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";
import { ModelProviderSettings, Provider } from "../components/settings/ModelProviderSettings";
import { SecretsVaultSettings } from "../components/settings/SecretsVaultSettings";

const tabs = [
  { id: "ai", label: "AI Models", icon: Brain },
  { id: "security", label: "Security & Vault", icon: Shield },
  { id: "profile", label: "Profile", icon: User },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "workspace", label: "Workspace", icon: Database },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("ai");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/providers`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setProviders(data.data || []);
    } catch (err) {
      console.error("Failed to fetch providers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1A191B] text-[#F4EFE6] overflow-hidden select-none p-6">
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col">
        <h1 className="text-xl font-bold text-white mb-4">System & AI Provider Settings</h1>

        <div className="flex items-center gap-2 border-b border-stone-800 pb-3 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0",
                  isActive
                    ? "bg-[#FF5E38] text-white shadow-md"
                    : "bg-[#252428] text-stone-400 hover:text-white hover:bg-stone-800"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 bg-[#1A191B] rounded-2xl border border-stone-800 p-6 overflow-y-auto">
          {activeTab === "ai" && (
            <ModelProviderSettings
              providers={providers}
              loading={loading}
              onRefresh={fetchProviders}
            />
          )}

          {activeTab === "security" && <SecretsVaultSettings />}

          {activeTab === "profile" && (
            <div className="space-y-4 text-xs text-stone-300">
              <h3 className="font-bold text-white text-sm">User Profile</h3>
              <p>Local account settings and application theme preferences.</p>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-4 text-xs text-stone-300">
              <h3 className="font-bold text-white text-sm">Desktop App Integrations</h3>
              <p>Microsoft Excel Desktop, Word, and local PDF reader applications.</p>
            </div>
          )}

          {activeTab === "workspace" && (
            <div className="space-y-4 text-xs text-stone-300">
              <h3 className="font-bold text-white text-sm">Workspace Storage</h3>
              <p>Local document directory connected with FTS5 search index.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
