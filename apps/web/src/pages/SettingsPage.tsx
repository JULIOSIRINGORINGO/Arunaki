/* Hallmark · macrostructure: Tabbed Settings · theme: Studio · accent: green */
import { useState } from "react";
import { User, Brain, Puzzle, Shield, Palette, Database, Info, Sun, Moon } from "lucide-react";
import { cn } from "../lib/utils";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "ai", label: "AI Models", icon: Brain },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "workspace", label: "Workspace", icon: Database },
  { id: "security", label: "Security", icon: Shield },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-surface-900">
          Settings
        </h1>
        <p className="text-[13px] text-surface-500 mt-0.5">
          Konfigurasi Arunaki agent Anda
        </p>
      </div>

      <div className="flex gap-6">
        <nav className="w-44 shrink-0">
          <div className="space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                  activeTab === tab.id
                    ? "bg-accent/10 text-accent"
                    : "text-surface-500 hover:text-surface-800 hover:bg-surface-200/60"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === "profile" && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                <h3 className="text-[13px] font-semibold text-surface-800 mb-3.5">
                  Personal Information
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      defaultValue="User"
                      className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-150"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                <h3 className="text-[13px] font-semibold text-surface-800 mb-3.5 flex items-center gap-2">
                  <Palette size={14} className="text-surface-500" />
                  Appearance
                </h3>
                <div className="flex gap-2.5">
                  {([
                    { value: "light" as const, icon: Sun, label: "Light" },
                    { value: "dark" as const, icon: Moon, label: "Dark" },
                  ]).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all duration-150",
                        theme === t.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-surface-300 hover:border-surface-400 text-surface-600"
                      )}
                    >
                      <t.icon size={14} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                <h3 className="text-[13px] font-semibold text-surface-800 mb-3.5 flex items-center gap-2">
                  <Brain size={14} className="text-surface-500" />
                  Chat Model
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                      Model
                    </label>
                    <select className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-150">
                      <option>nvidia/nemotron-3-ultra-550b-a55b:free</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                      Temperature
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      defaultValue="0.7"
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-surface-500 mt-1">
                      <span>Precise (0)</span>
                      <span>Creative (1)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-200 border border-surface-300 rounded-lg p-4">
                <div className="flex items-start gap-2.5">
                  <Info size={14} className="text-accent mt-0.5 shrink-0" />
                  <p className="text-[11px] text-surface-600 leading-relaxed">
                    Model saat ini menggunakan NVIDIA Nemotron 3 Ultra via OpenRouter.
                    Anda dapat mengganti model di settings ini.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-6 text-center py-14">
                <Puzzle className="mx-auto text-surface-400 mb-2" size={28} />
                <p className="text-[13px] text-surface-500">
                  Integrasi akan segera hadir.
                </p>
              </div>
            </div>
          )}

          {activeTab === "workspace" && (
            <div className="animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                <h3 className="text-[13px] font-semibold text-surface-800 mb-3.5">
                  Default Workspace Settings
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                      Storage Location
                    </label>
                    <p className="text-[11px] text-surface-500">
                      Local filesystem storage. Documents are stored on the server.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-6 text-center py-14">
                <Shield className="mx-auto text-surface-400 mb-2" size={28} />
                <p className="text-[13px] text-surface-500">
                  Security settings akan segera hadir.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 bg-surface-200 border border-surface-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                <span className="text-accent text-[13px] font-bold">A</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-surface-800">Arunaki AI Agent v0.1</p>
                <p className="text-[11px] text-surface-500">
                  Autonomous Workspace Agent for document analysis
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
