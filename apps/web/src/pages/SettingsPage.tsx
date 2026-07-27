import { useState, useEffect } from "react";
import {
  User, Brain, Puzzle, Shield, Database, Info, Sun, Moon,
  Plus, Trash2, Check, X, Loader2, Wifi, WifiOff, Eye, EyeOff,
  ChevronDown, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:3000/api/v1";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "ai", label: "AI Models", icon: Brain },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "workspace", label: "Workspace", icon: Database },
  { id: "security", label: "Security", icon: Shield },
];

interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headerPrefix?: string;
  headerTitle?: string;
  active: boolean;
  priority: number;
  lastUsedAt?: string;
  lastErrorAt?: string;
  lastError?: string;
}

const PROVIDER_TYPES = [
  { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "openai", label: "OpenAI", defaultUrl: "https://api.openai.com/v1" },
  { value: "anthropic", label: "Anthropic", defaultUrl: "https://api.anthropic.com/v1" },
  { value: "openai-compatible", label: "OpenAI-Compatible", defaultUrl: "" },
  { value: "ollama", label: "Ollama (Local)", defaultUrl: "http://localhost:11434/v1" },
];

const DEFAULT_MODELS: Record<string, string[]> = {
  openrouter: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "google/gemini-2.5-flash",
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o",
    "meta-llama/llama-4-maverick:free",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
  ollama: ["llama3.1", "mistral", "codellama", "gemma2"],
  "openai-compatible": [],
};

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("ai");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Provider state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; reply?: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // Form state
  const [form, setForm] = useState({
    name: "",
    type: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    headerPrefix: "",
    headerTitle: "",
  });

  // Fetch providers
  const fetchProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/providers`);
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

  // Reset form
  const resetForm = () => {
    setForm({
      name: "",
      type: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "",
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      headerPrefix: "",
      headerTitle: "",
    });
    setShowAddForm(false);
    setEditingId(null);
    setTestResult(null);
  };

  // Handle provider type change — update default URL and model
  const handleTypeChange = (type: string) => {
    const pt = PROVIDER_TYPES.find((p) => p.value === type);
    const models = DEFAULT_MODELS[type] || [];
    setForm((f) => ({
      ...f,
      type,
      baseUrl: pt?.defaultUrl || "",
      model: models[0] || "",
    }));
  };

  // Create or update provider
  const handleSave = async () => {
    try {
      if (editingId) {
        // Update
        await fetch(`${API_BASE}/providers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        // Create
        await fetch(`${API_BASE}/providers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, active: providers.length === 0 }),
        });
      }
      resetForm();
      fetchProviders();
    } catch (err) {
      console.error("Failed to save provider:", err);
    }
  };

  // Test connection
  const handleTest = async (provider: Provider) => {
    setTestingId(provider.id);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/providers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey === "" ? form.apiKey : provider.apiKey,
          model: provider.model,
        }),
      });
      const data = await res.json();
      setTestResult(data.data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingId(null);
    }
  };

  // Activate provider
  const handleActivate = async (id: string) => {
    try {
      await fetch(`${API_BASE}/providers/${id}/activate`, { method: "PATCH" });
      fetchProviders();
    } catch (err) {
      console.error("Failed to activate provider:", err);
    }
  };

  // Delete provider
  const handleDelete = async (id: string) => {
    if (!confirm("Hapus provider ini?")) return;
    try {
      await fetch(`${API_BASE}/providers/${id}`, { method: "DELETE" });
      fetchProviders();
    } catch (err) {
      console.error("Failed to delete provider:", err);
    }
  };

  // Start editing
  const startEdit = (provider: Provider) => {
    setForm({
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: "", // Don't pre-fill — user must re-enter
      model: provider.model,
      headerPrefix: provider.headerPrefix || "",
      headerTitle: provider.headerTitle || "",
    });
    setEditingId(provider.id);
    setShowAddForm(true);
    setTestResult(null);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-surface-900">Settings</h1>
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
          {/* ===== AI MODELS TAB ===== */}
          {activeTab === "ai" && (
            <div className="space-y-5 animate-fade-in">
              {/* Provider list */}
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-semibold text-surface-800 flex items-center gap-2">
                    <Brain size={14} className="text-surface-500" />
                    AI Providers
                  </h3>
                  <button
                    onClick={() => { resetForm(); setShowAddForm(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/10 text-accent rounded-lg text-[12px] font-medium hover:bg-accent/20 transition-colors"
                  >
                    <Plus size={12} />
                    Tambah Provider
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-[13px] text-surface-500">
                    <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                    Memuat provider...
                  </div>
                ) : providers.length === 0 ? (
                  <div className="text-center py-8">
                    <WifiOff size={24} className="mx-auto text-surface-400 mb-2" />
                    <p className="text-[13px] text-surface-500 mb-1">Belum ada provider dikonfigurasi</p>
                    <p className="text-[11px] text-surface-400">Tambahkan provider untuk mulai menggunakan AI</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {providers.map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all",
                          p.active
                            ? "border-accent/30 bg-accent/5"
                            : "border-surface-200 hover:border-surface-300"
                        )}
                      >
                        {/* Status indicator */}
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          p.active ? "bg-green-500" : "bg-surface-300"
                        )} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-surface-800 truncate">
                              {p.name}
                            </span>
                            {p.active && (
                              <span className="px-1.5 py-0.5 bg-accent/15 text-accent text-[10px] font-medium rounded">
                                AKTIF
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-surface-500">{p.model}</span>
                            <span className="text-[10px] text-surface-400">•</span>
                            <span className="text-[11px] text-surface-400 truncate max-w-[200px]">
                              {p.baseUrl}
                            </span>
                          </div>
                          {p.lastError && (
                            <p className="text-[10px] text-red-500 mt-1 truncate">
                              Error: {p.lastError}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!p.active && (
                            <button
                              onClick={() => handleActivate(p.id)}
                              className="px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/10 rounded transition-colors"
                              title="Aktifkan"
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => handleTest(p)}
                            disabled={testingId === p.id}
                            className="px-2 py-1 text-[11px] font-medium text-surface-500 hover:bg-surface-200 rounded transition-colors"
                            title="Test koneksi"
                          >
                            {testingId === p.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Wifi size={12} />
                            )}
                          </button>
                          <button
                            onClick={() => startEdit(p)}
                            className="px-2 py-1 text-[11px] font-medium text-surface-500 hover:bg-surface-200 rounded transition-colors"
                            title="Edit"
                          >
                            <Zap size={12} />
                          </button>
                          {!p.active && (
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Test result */}
                {testResult && (
                  <div className={cn(
                    "mt-3 p-3 rounded-lg border text-[12px]",
                    testResult.success
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  )}>
                    {testResult.success ? (
                      <div className="flex items-center gap-2">
                        <Wifi size={12} />
                        <span>Koneksi berhasil! Reply: "{testResult.reply}"</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <WifiOff size={12} />
                        <span>Gagal: {testResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add/Edit form */}
              {showAddForm && (
                <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                  <h3 className="text-[13px] font-semibold text-surface-800 mb-4">
                    {editingId ? "Edit Provider" : "Tambah Provider Baru"}
                  </h3>

                  <div className="space-y-3.5">
                    {/* Name */}
                    <div>
                      <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                        Nama Provider
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Contoh: OpenRouter Saya"
                        className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                        Tipe Provider
                      </label>
                      <select
                        value={form.type}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
                      >
                        {PROVIDER_TYPES.map((pt) => (
                          <option key={pt.value} value={pt.value}>{pt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Base URL */}
                    <div>
                      <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={form.baseUrl}
                        onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                        placeholder="https://openrouter.ai/api/v1"
                        className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                      />
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                        API Key
                        {editingId && (
                          <span className="text-surface-400 ml-1">(kosongkan jika tidak diubah)</span>
                        )}
                      </label>
                      <input
                        type="password"
                        value={form.apiKey}
                        onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                        placeholder={editingId ? "••••••••" : "sk-or-... atau sk-..."}
                        className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                      />
                    </div>

                    {/* Model */}
                    <div>
                      <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                        Model
                      </label>
                      {(DEFAULT_MODELS[form.type] || []).length > 0 ? (
                        <div className="flex gap-2">
                          <select
                            value={form.model}
                            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                            className="flex-1 px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
                          >
                            {(DEFAULT_MODELS[form.type] || []).map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={form.model}
                            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                            placeholder="atau ketik model name"
                            className="flex-1 px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={form.model}
                          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                          placeholder="model-name (e.g. gpt-4o)"
                          className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                        />
                      )}
                    </div>

                    {/* Custom headers (optional) */}
                    <div className="border-t border-surface-200 pt-3.5 mt-3.5">
                      <p className="text-[11px] text-surface-400 mb-3">Custom Headers (opsional)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                            HTTP-Referer
                          </label>
                          <input
                            type="text"
                            value={form.headerPrefix}
                            onChange={(e) => setForm((f) => ({ ...f, headerPrefix: e.target.value }))}
                            placeholder="https://arunaki.app"
                            className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
                            X-Title
                          </label>
                          <input
                            type="text"
                            value={form.headerTitle}
                            onChange={(e) => setForm((f) => ({ ...f, headerTitle: e.target.value }))}
                            placeholder="Arunaki AI Assistant"
                            className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSave}
                      disabled={!form.name || !form.baseUrl || !form.model || (!editingId && !form.apiKey)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors",
                        form.name && form.baseUrl && form.model && (editingId || form.apiKey)
                          ? "bg-accent text-white hover:bg-accent/90"
                          : "bg-surface-200 text-surface-400 cursor-not-allowed"
                      )}
                    >
                      <Check size={12} />
                      {editingId ? "Simpan Perubahan" : "Tambah Provider"}
                    </button>
                    <button
                      onClick={resetForm}
                      className="px-3 py-2 rounded-lg text-[12px] font-medium text-surface-500 hover:bg-surface-200 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Info box */}
              <div className="bg-surface-200 border border-surface-300 rounded-lg p-4">
                <div className="flex items-start gap-2.5">
                  <Info size={14} className="text-accent mt-0.5 shrink-0" />
                  <div className="text-[11px] text-surface-600 leading-relaxed">
                    <p className="mb-1">
                      <strong>OpenRouter</strong> direkomendasikan untuk pemula — satu API key untuk ratusan model.
                    </p>
                    <p className="mb-1">
                      <strong>OpenAI/Anthropic</strong> untuk kualitas terbaik dengan API key langsung dari provider.
                    </p>
                    <p>
                      <strong>Ollama</strong> untuk menjalankan model lokal tanpa API key (butuh GPU).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== PROFILE TAB ===== */}
          {activeTab === "profile" && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                <h3 className="text-[13px] font-semibold text-surface-800 mb-3.5">
                  Personal Information
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">Name</label>
                    <input
                      type="text"
                      defaultValue="User"
                      className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">Email</label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
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
                        "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all",
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

          {/* ===== OTHER TABS ===== */}
          {activeTab === "integrations" && (
            <div className="animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-6 text-center py-14">
                <Puzzle className="mx-auto text-surface-400 mb-2" size={28} />
                <p className="text-[13px] text-surface-500">Integrasi akan segera hadir.</p>
              </div>
            </div>
          )}

          {activeTab === "workspace" && (
            <div className="animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-5">
                <h3 className="text-[13px] font-semibold text-surface-800 mb-3.5">Default Workspace Settings</h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-surface-600 mb-1.5">Storage Location</label>
                    <p className="text-[11px] text-surface-500">Local filesystem storage. Documents are stored on the server.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="animate-fade-in">
              <div className="bg-surface-100 border border-surface-200 rounded-lg p-6 text-center py-14">
                <Shield className="mx-auto text-surface-400 mb-2" size={28} />
                <p className="text-[13px] text-surface-500">Security settings akan segera hadir.</p>
              </div>
            </div>
          )}

          {/* Version */}
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
