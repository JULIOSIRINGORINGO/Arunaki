import { useState } from "react";
import { Plus, Trash2, Check, Loader2, Wifi } from "lucide-react";
import { API_BASE, apiFetch } from "../../lib/api";
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
  { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "kenari", label: "Kenari (Kenari.id)", defaultUrl: "https://api.kenari.id/v1" },
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
  kenari: ["gpt-oss-120b", "deepseek-v4-flash", "llama-3-1-70b-instruct"],
  "openai-compatible": [],
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
        toast.success("Provider berhasil diperbarui!");
      } else {
        await apiFetch(`${API_BASE}/providers`, {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Provider berhasil ditambahkan!");
      }
      resetForm();
      onRefresh();
    } catch {
      toast.error("Gagal menyimpan provider.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus provider ini?")) return;
    try {
      await apiFetch(`${API_BASE}/providers/${id}`, { method: "DELETE" });
      toast.success("Provider berhasil dihapus!");
      onRefresh();
    } catch {
      toast.error("Gagal menghapus provider.");
    }
  };

  const handleToggleActive = async (provider: Provider) => {
    try {
      await apiFetch(`${API_BASE}/providers/${provider.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !provider.active }),
      });
      toast.success(`Provider ${provider.active ? "dinonaktifkan" : "diaktifkan"}`);
      onRefresh();
    } catch {
      toast.error("Gagal memperbarui status provider.");
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiFetch(`${API_BASE}/providers/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.data?.success) {
        toast.success("Koneksi berhasil!");
      } else {
        toast.error(`Koneksi gagal: ${data.data?.error || "Unknown error"}`);
      }
    } catch (err: any) {
      toast.error(`Koneksi gagal: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#F4EFE6]">Custom LLM Provider Catalogs</h3>
          <p className="text-xs text-stone-400">
            Kelola kunci API, URL Endpoint, dan dynamic model fallback.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5E38] hover:bg-[#e04e2a] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Provider</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSave} className="p-4 bg-[#252428] rounded-2xl border border-stone-700 space-y-4">
          <h4 className="text-xs font-bold text-white">
            {editingId ? "Edit Provider" : "Tambah Provider Baru"}
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-stone-300 mb-1 font-medium">Tipe Provider</label>
              <select
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full bg-[#1A191B] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {PROVIDER_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-stone-300 mb-1 font-medium">Nama Tampilan</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: OpenRouter Primary"
                className="w-full bg-[#1A191B] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-stone-300 mb-1 font-medium">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full bg-[#1A191B] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 bg-[#1A191B] text-stone-400 text-xs rounded-lg font-medium cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#FF5E38] text-white text-xs rounded-lg font-semibold cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#FF5E38] animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className="p-3 bg-[#252428] rounded-xl border border-stone-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div
                  onClick={() => handleToggleActive(p)}
                  className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer border ${
                    p.active ? "bg-[#FF5E38] border-[#FF5E38] text-white" : "border-stone-600"
                  }`}
                >
                  {p.active && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <span className="font-semibold text-white">{p.name}</span>
                  <span className="text-[10px] text-stone-400 block">{p.model}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestConnection(p.id)}
                  disabled={testingId === p.id}
                  className="px-2.5 py-1 bg-[#1A191B] hover:bg-stone-800 text-[#C4B5FD] text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  {testingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                  <span>Tes</span>
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1 text-stone-400 hover:text-red-400 rounded cursor-pointer"
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
