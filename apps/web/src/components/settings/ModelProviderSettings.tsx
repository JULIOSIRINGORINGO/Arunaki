import { useState } from "react";
import { Plus, Trash2, Check, Loader2, Wifi } from "lucide-react";
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

  const [form, setForm] = useState({
    name: "",
    type: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    headerPrefix: "",
    headerTitle: "",
  });

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
        toast.success("Provider updated successfully!");
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
    if (!confirm("Delete this provider?")) return;
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

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiFetch(`${API_BASE}/providers/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.data?.success) {
        toast.success("Connection successful!");
      } else {
        toast.error(`Connection failed: ${data.data?.error || "Unknown error"}`);
      }
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`);
    } finally {
      setTestingId(null);
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
            Manage API keys, endpoint URLs, and dynamic model fallback.
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
          <span>Add Provider</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSave} className="p-4 bg-[#181818] rounded-xl border border-[#262626] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white">
              {editingId ? "Edit Provider Catalog" : "Add New Provider Catalog"}
            </h4>
            <span className="text-[10px] text-[#A3A3A3]">Atur URL Endpoint & Nama Model</span>
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
                placeholder="Example: 9Router Local / OpenRouter Primary"
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
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">Model ID / Name</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. deepseek-v4-flash, gpt-4o, gemini-2.5-flash"
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
                required
              />
              {DEFAULT_MODELS[form.type]?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {DEFAULT_MODELS[form.type].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, model: m })}
                      className="px-1.5 py-0.5 bg-[#262626] hover:bg-[#333333] text-[10px] text-[#A3A3A3] hover:text-white rounded border border-[#333333] transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-... (Leave empty if local proxy without key)"
              className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className={cn(
                "p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all",
                p.active
                  ? "bg-[#181818] border-[#333333]"
                  : "bg-[#121212] border-[#262626] opacity-75 hover:opacity-100"
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleActive(p)}
                  title={p.active ? "Model Utama (Aktif)" : "Jadikan Model Utama"}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border",
                    p.active
                      ? "bg-white text-black border-white"
                      : "bg-[#262626] text-[#A3A3A3] hover:text-white border-[#333333]"
                  )}
                >
                  <Check className={cn("w-3 h-3", p.active && "stroke-[3]")} />
                  <span>{p.active ? "Utama" : "Set Utama"}</span>
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="text-[10px] text-[#737373] font-mono px-1.5 py-0.5 bg-[#0A0A0A] border border-[#262626] rounded">
                      {p.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-emerald-400 font-medium">
                      {p.model}
                    </span>
                    <span className="text-[10px] text-[#737373]">
                      ({p.baseUrl || "Default API URL"})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestConnection(p.id)}
                  disabled={testingId === p.id}
                  className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-white border border-[#333333] text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  {testingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3 text-emerald-400" />}
                  <span>Tes</span>
                </button>
                <button
                  onClick={() => handleEdit(p)}
                  className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-[#A3A3A3] hover:text-white border border-[#333333] text-[11px] rounded-lg transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1 text-[#A3A3A3] hover:text-red-400 rounded cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
