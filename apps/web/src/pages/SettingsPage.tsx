import { useState, useEffect } from "react";
import { User, Brain, Puzzle, Database, CheckCircle2, RefreshCw, Monitor, FileSpreadsheet, FileText, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";
import { ModelProviderSettings, Provider } from "../components/settings/ModelProviderSettings";

const tabs = [
  { id: "ai", label: "AI Models", icon: Brain },
  { id: "profile", label: "Profile & Persona", icon: User },
  { id: "integrations", label: "Desktop Integrations", icon: Puzzle },
  { id: "workspace", label: "Workspace & Storage", icon: Database },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("ai");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile State
  const [userName, setUserName] = useState(() => localStorage.getItem("arunaki_user_name") || "Arunaki Assistant");
  const [persona, setPersona] = useState(() => localStorage.getItem("arunaki_persona") || "standard");
  const [language, setLanguage] = useState(() => localStorage.getItem("arunaki_lang") || "auto");

  // Workspace Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const activeWsId = localStorage.getItem("arunaki_workspace_id");

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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("arunaki_user_name", userName);
    localStorage.setItem("arunaki_persona", persona);
    localStorage.setItem("arunaki_lang", language);
    toast.success("Profile and persona preferences saved!");
  };

  const handleTestDesktopBridge = () => {
    const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
    if (desktop) {
      toast.success("Desktop Bridge Connected: Electron IPC channel active!");
    } else {
      toast.info("Web Mode: Electron Bridge active when launched from Desktop Shell.");
    }
  };

  const handleSyncWorkspaceDisk = async () => {
    if (!activeWsId) {
      toast.error("No active workspace connected.");
      return;
    }
    setIsSyncing(true);
    try {
      await apiFetch(`${API_BASE}/workspaces/${activeWsId}/sync`, { method: "POST" });
      toast.success("Workspace files successfully resynced from disk!");
    } catch {
      toast.error("Failed to sync workspace files.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-y-auto select-none p-6 transition-colors duration-150">
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col min-h-0">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4">System & AI Settings</h1>

        <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3 mb-6 overflow-x-auto shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 border",
                  isActive
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 bg-[var(--bg-panel)] rounded-xl border border-[var(--border-color)] p-6 overflow-y-auto min-h-0 transition-colors duration-150">
          {activeTab === "ai" && (
            <ModelProviderSettings
              providers={providers}
              loading={loading}
              onRefresh={fetchProviders}
            />
          )}

          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6 max-w-lg">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-base mb-1">User & Digital Employee Persona</h3>
                <p className="text-xs text-[var(--text-muted)]">Configure Assistant branding and AI posture behavior.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    Assistant Display Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    AI Working Posture / Persona
                  </label>
                  <select
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
                  >
                    <option value="standard">Standard Digital Employee (Balanced & Proactive)</option>
                    <option value="analyst">Financial & Data Analyst (Strict Numbers Focus)</option>
                    <option value="executive">Executive Assistant (Concise Summaries)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    Response Language Preference
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
                  >
                    <option value="auto">Auto-Detect User Language</option>
                    <option value="en">English (Primary English Output)</option>
                    <option value="id">Bahasa Indonesia (Utamakan Bahasa Indonesia)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Save Persona Settings
              </button>
            </form>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-base mb-1">Desktop & Office Integrations</h3>
                <p className="text-xs text-[var(--text-muted)]">Native desktop app control and Electron IPC bridge status.</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-primary)]">Electron Desktop Bridge</h4>
                      <p className="text-[11px] text-[var(--text-muted)]">Native filesystem and window control IPC</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold border border-emerald-500/20">
                    Active
                  </span>
                </div>

                <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-primary)]">Microsoft Excel (.xlsx, .csv)</h4>
                      <p className="text-[11px] text-[var(--text-muted)]">COM Automation & Cell Editing Engine</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>

                <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-primary)]">Microsoft Word & PDF Reader</h4>
                      <p className="text-[11px] text-[var(--text-muted)]">Document generation & FTS5 indexing</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestDesktopBridge}
                className="px-4 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-strong)] text-[var(--text-primary)] rounded-lg text-xs font-medium border border-[var(--border-strong)] transition-colors cursor-pointer"
              >
                Test Desktop Bridge Connection
              </button>
            </div>
          )}

          {activeTab === "workspace" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-base mb-1">Workspace Storage & Security Isolation</h3>
                <p className="text-xs text-[var(--text-muted)]">Manage connected workspace disk folder and FTS5 search index.</p>
              </div>

              <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">Active Workspace ID:</span>
                  <span className="text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-panel)] px-2 py-1 rounded border border-[var(--border-color)]">
                    {activeWsId || "No workspace selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-muted)]">Security Isolation:</span>
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Strict Directory Sandbox
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSyncWorkspaceDisk}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                  <span>{isSyncing ? "Resyncing Files..." : "Resync Workspace Files from Disk"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
