import { useState, useEffect } from "react";
import { Plus, Trash2, Check, Loader2, Wifi, Bot, Settings2 } from "lucide-react";
import { API_BASE, apiFetch } from "../../lib/api";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

export interface Provider {
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
  { value: "9router", label: "9Router (Local Gateway)", defaultUrl: "http://localhost:20128/v1" },
  { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "kenari", label: "Kenari (Kenari.id)", defaultUrl: "https://api.kenari.id/v1" },
  { value: "openai", label: "OpenAI", defaultUrl: "https://api.openai.com/v1" },
  { value: "anthropic", label: "Anthropic", defaultUrl: "https://api.anthropic.com/v1" },
  { value: "openai-compatible", label: "OpenAI-Compatible", defaultUrl: "" },
  { value: "ollama", label: "Ollama (Local)", defaultUrl: "http://localhost:11434/v1" },
];

const DEFAULT_MODELS: Record<string, string[]> = {
  "9router": [
    "cx/gpt-5.6-terra",
    "cx/gpt-5.5",
    "cx/gpt-5.4-mini",
    "cx/gpt-5.6-luna",
    "deepseek-r1",
    "claude-3-5-sonnet",
  ],
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
  kenari: ["gpt-oss-120b", "deepseek-v4-flash", "llama-3-1-70b-instruct"],
  "openai-compatible": ["cx/gpt-5.6-terra", "cx/gpt-5.5", "cx/gpt-5.4-mini"],
};

interface ModelProviderSettingsProps {
  providers: Provider[];
  loading: boolean;
  onRefresh: () => void;
}

export function ModelProviderSettings({
  providers,
  loading,
  onRefresh,
}: ModelProviderSettingsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isTestingForm, setIsTestingForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; status?: number; error?: string; timeMs?: number }>>({});

  // 9Router-style Custom Models per Provider State
  const [addingModelProviderId, setAddingModelProviderId] = useState<string | null>(null);
  const [newModelInput, setNewModelInput] = useState("");
  const [customModelsMap, setCustomModelsMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem("arunaki_custom_provider_models");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("arunaki_custom_provider_models", JSON.stringify(customModelsMap));
  }, [customModelsMap]);

  const [form, setForm] = useState({
    name: "",
    type: "9router",
    baseUrl: "http://localhost:20128/v1",
    apiKey: "",
    model: "cx/gpt-5.6-terra",
    headerPrefix: "",
    headerTitle: "",
  });

  const resetForm = () => {
    setForm({
      name: "",
      type: "9router",
      baseUrl: "http://localhost:20128/v1",
      apiKey: "",
      model: "cx/gpt-5.6-terra",
      headerPrefix: "",
      headerTitle: "",
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleTypeChange = (type: string) => {
    const pt = PROVIDER_TYPES.find((p) => p.value === type);
    const defaultModel = DEFAULT_MODELS[type]?.[0] || "";
    setForm((f) => ({
      ...f,
      type,
      baseUrl: pt?.defaultUrl || f.baseUrl,
      model: defaultModel,
      name: pt?.label || f.name,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`${API_BASE}/providers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Provider connection updated successfully!");
      } else {
        await apiFetch(`${API_BASE}/providers`, {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Provider added successfully!");
      }
      resetForm();
      onRefresh();
    } catch {
      toast.error("Failed to save provider.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this provider catalog?")) return;
    try {
      await apiFetch(`${API_BASE}/providers/${id}`, { method: "DELETE" });
      toast.success("Provider deleted successfully!");
      onRefresh();
    } catch {
      toast.error("Failed to delete provider.");
    }
  };

  const handleToggleActive = async (provider: Provider) => {
    try {
      await apiFetch(`${API_BASE}/providers/${provider.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !provider.active }),
      });
      toast.success(`Provider ${provider.active ? "deactivated" : "activated"}`);
      onRefresh();
    } catch {
      toast.error("Failed to update provider status.");
    }
  };

  const handleSelectModel = async (provider: Provider, modelName: string) => {
    try {
      await apiFetch(`${API_BASE}/providers/${provider.id}`, {
        method: "PUT",
        body: JSON.stringify({ model: modelName }),
      });
      toast.success(`Active model updated to ${modelName}`);
      onRefresh();
    } catch {
      toast.error("Failed to switch model.");
    }
  };

  const handleAddNewModelSubmit = async (provider: Provider, e: React.FormEvent) => {
    e.preventDefault();
    const cleanModel = newModelInput.trim();
    if (!cleanModel) return;

    setCustomModelsMap((prev) => {
      const existing = prev[provider.id] || [];
      if (existing.includes(cleanModel)) return prev;
      return { ...prev, [provider.id]: [...existing, cleanModel] };
    });

    await handleSelectModel(provider, cleanModel);
    setAddingModelProviderId(null);
    setNewModelInput("");
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    const startMs = Date.now();
    try {
      const res = await apiFetch(`${API_BASE}/providers/${id}/test`, { method: "POST" });
      const data = await res.json();
      const elapsed = Date.now() - startMs;
      const isOk = data.data?.success;

      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: !!isOk,
          status: data.data?.status || (isOk ? 200 : 500),
          error: data.data?.error,
          timeMs: elapsed,
        },
      }));

      if (isOk) {
        toast.success(`Ping successful! (${elapsed}ms)`);
      } else {
        toast.error(`Connection failed: ${data.data?.error || "Invalid response"}`);
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, error: err.message },
      }));
      toast.error(`Connection failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleTestFormConnection = async () => {
    setIsTestingForm(true);
    const startMs = Date.now();
    try {
      const res = await apiFetch(`${API_BASE}/providers/test`, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
        }),
      });
      const data = await res.json();
      const elapsed = Date.now() - startMs;
      if (data.data?.success) {
        toast.success(`Test Ping Successful! (${elapsed}ms) — Model ${form.model} responding.`);
      } else {
        toast.error(`Test Ping Failed: ${data.data?.error || "No response"}`);
      }
    } catch (err: any) {
      toast.error(`Test Ping Error: ${err.message}`);
    } finally {
      setIsTestingForm(false);
    }
  };

  const handleEdit = (p: Provider) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      type: p.type,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey || "",
      model: p.model,
      headerPrefix: p.headerPrefix || "",
      headerTitle: p.headerTitle || "",
    });
    setShowAddForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Custom LLM Provider Catalogs</h3>
          <p className="text-xs text-[#A3A3A3]">
            Manage provider credentials once, then easily select or add models (9Router / OpenRouter style).
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-[#E5E5E5] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Provider Catalog</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSave} className="p-4 bg-[#181818] rounded-xl border border-[#262626] space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-400" />
              {editingId ? "Sunting Provider Connection" : "Tambah Provider Connection Baru"}
            </h4>
            <span className="text-[10px] text-[#A3A3A3]">Simpan URL & API Key 1x</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">Provider Type</label>
              <select
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#525252]"
              >
                {PROVIDER_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Kenari.id / 9Router Local / OpenRouter"
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">Base URL / Endpoint</label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="http://localhost:20128/v1"
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">Initial Active Model ID</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. deepseek-v4-flash, cx/gpt-5.6-terra"
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-... (Kosongkan jika local proxy tanpa key)"
              className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
            />
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-[#262626]">
            <button
              type="button"
              onClick={handleTestFormConnection}
              disabled={isTestingForm}
              className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] text-white text-xs rounded-lg font-medium cursor-pointer flex items-center gap-1.5 border border-[#333333] transition-colors"
            >
              {isTestingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isTestingForm ? "Testing Ping..." : "Test Connection"}</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] text-white text-xs rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-white text-black hover:bg-[#E5E5E5] text-xs rounded-lg font-semibold cursor-pointer"
              >
                Save Provider
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((p) => {
            const result = testResults[p.id];
            const defaultModelsForType = DEFAULT_MODELS[p.type] || DEFAULT_MODELS["openai-compatible"] || [];
            const customModels = customModelsMap[p.id] || [];
            const allAvailableModels = Array.from(new Set([p.model, ...customModels, ...defaultModelsForType]));

            return (
              <div
                key={p.id}
                className={cn(
                  "p-4 rounded-xl border space-y-4 transition-all",
                  p.active
                    ? "bg-[#181818] border-[#333333] shadow-md"
                    : "bg-[#121212] border-[#262626] opacity-90 hover:opacity-100"
                )}
              >
                {/* Header Provider Connection */}
                <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(p)}
                      title={p.active ? "Provider Utama (Aktif)" : "Jadikan Provider Utama"}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border",
                        p.active
                          ? "bg-white text-black border-white"
                          : "bg-[#262626] text-[#A3A3A3] hover:text-white border-[#333333]"
                      )}
                    >
                      <Check className={cn("w-3.5 h-3.5", p.active && "stroke-[3]")} />
                      <span>{p.active ? "Provider Utama" : "Set Provider Utama"}</span>
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{p.name}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0A0A0A] border border-[#262626] rounded text-[#A3A3A3]">
                          {p.type}
                        </span>
                        {result && (
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1",
                              result.success
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", result.success ? "bg-emerald-400" : "bg-red-400")} />
                            {result.success ? `success (${result.timeMs}ms)` : `failed (${result.error || result.status})`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#737373] font-mono mt-0.5">
                        {p.baseUrl || "Default API Endpoint"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(p.id)}
                      disabled={testingId === p.id}
                      className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-white border border-[#333333] text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {testingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3 text-emerald-400" />}
                      <span>{testingId === p.id ? "Testing..." : "Tes"}</span>
                    </button>
                    <button
                      onClick={() => handleEdit(p)}
                      className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-[#A3A3A3] hover:text-white border border-[#333333] text-[11px] rounded-lg transition-colors cursor-pointer"
                    >
                      Sunting API & URL
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-[#A3A3A3] hover:text-red-400 rounded cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Available Models Catalog Section (9Router Style) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      Available Models ({allAvailableModels.length})
                    </span>
                    <span className="text-[10px] text-[#737373]">Klik model mana saja untuk memilih model aktif</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allAvailableModels.map((m) => {
                      const isSelected = p.model === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleSelectModel(p, m)}
                          className={cn(
                            "p-2.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#262626] border-white text-white shadow-xs"
                              : "bg-[#121212] border-[#262626] text-[#A3A3A3] hover:text-white hover:border-[#333333]"
                          )}
                        >
                          <div className="truncate pr-2">
                            <span className="font-mono text-xs block truncate font-medium">{m}</span>
                            <span className="text-[9px] text-[#737373]">{isSelected ? "● Aktif Dipakai" : "Klik untuk aktifkan"}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[3]" />}
                        </button>
                      );
                    })}

                    {/* Inline + Add Model Button */}
                    {addingModelProviderId === p.id ? (
                      <form onSubmit={(e) => handleAddNewModelSubmit(p, e)} className="flex items-center gap-1 bg-[#121212] p-1.5 rounded-lg border border-[#333333]">
                        <input
                          type="text"
                          value={newModelInput}
                          onChange={(e) => setNewModelInput(e.target.value)}
                          placeholder="Nama model baru (misal: cx/gpt-5.6-terra)"
                          autoFocus
                          className="w-full bg-transparent text-xs text-white px-1.5 focus:outline-none placeholder-[#737373] font-mono"
                        />
                        <button type="submit" className="px-2 py-1 bg-white text-black text-[10px] font-bold rounded cursor-pointer shrink-0">Add</button>
                        <button type="button" onClick={() => setAddingModelProviderId(null)} className="px-1 text-xs text-[#A3A3A3] hover:text-white cursor-pointer shrink-0">✕</button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAddingModelProviderId(p.id); setNewModelInput(""); }}
                        className="p-2.5 rounded-lg border border-dashed border-[#333333] hover:border-[#525252] text-[#A3A3A3] hover:text-white flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer bg-[#121212]/50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Model</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
