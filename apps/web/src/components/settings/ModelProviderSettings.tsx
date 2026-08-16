import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { API_BASE, apiFetch } from "../../lib/api";
import { toast } from "sonner";
import { ProviderCard } from "./ProviderCard";
import { ProviderForm, type ProviderFormData } from "./ProviderForm";

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
  const [isFetchingFormModels, setIsFetchingFormModels] = useState(false);
  const [isAddingFormModel, setIsAddingFormModel] = useState(false);
  const [formNewModelInput, setFormNewModelInput] = useState("");
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; status?: number; error?: string; timeMs?: number }>>({});

  // 9Router-style Custom Models per Provider Map (persisted in localStorage)
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

  const [form, setForm] = useState<ProviderFormData>({
    name: "",
    type: "9router",
    baseUrl: "http://localhost:20128/v1",
    apiKey: "",
    model: "cx/gpt-5.6-terra",
    headerPrefix: "",
    headerTitle: "",
  });

  const [formAvailableModels, setFormAvailableModels] = useState<string[]>(DEFAULT_MODELS["9router"] || []);

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
    setFormAvailableModels(DEFAULT_MODELS["9router"] || []);
    setIsAddingFormModel(false);
    setFormNewModelInput("");
    setShowAddForm(false);
    setEditingId(null);
  };

  const getSelectedModels = (modelStr: string): string[] => {
    if (!modelStr) return [];
    return modelStr.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const handleToggleModelSelection = (m: string) => {
    const current = getSelectedModels(form.model);
    let updated: string[];
    if (current.includes(m)) {
      if (current.length <= 1) {
        toast.info("Minimal 1 model harus terpilih.");
        return;
      }
      updated = current.filter((id) => id !== m);
    } else {
      updated = [...current, m];
    }
    setForm((f) => ({ ...f, model: updated.join(", ") }));
  };

  const handleTypeChange = (type: string) => {
    const pt = PROVIDER_TYPES.find((p) => p.value === type);
    const defaults = DEFAULT_MODELS[type] || DEFAULT_MODELS["openai-compatible"] || [];
    const defaultModel = defaults[0] || "";
    setForm((f) => ({
      ...f,
      type,
      baseUrl: pt?.defaultUrl || f.baseUrl,
      model: defaultModel,
      name: pt?.label || f.name,
    }));
    setFormAvailableModels(defaults);
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

    const defaults = DEFAULT_MODELS[p.type] || DEFAULT_MODELS["openai-compatible"] || [];
    const custom = customModelsMap[p.id] || [];
    const existingModels = getSelectedModels(p.model);
    const combined = Array.from(new Set([...existingModels, ...custom, ...defaults]));
    setFormAvailableModels(combined);
    setIsAddingFormModel(false);
    setFormNewModelInput("");
    setShowAddForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let providerId = editingId;
      if (editingId) {
        await apiFetch(`${API_BASE}/providers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Provider connection updated successfully!");
      } else {
        const res = await apiFetch(`${API_BASE}/providers`, {
          method: "POST",
          body: JSON.stringify(form),
        });
        const data = await res.json();
        providerId = data.data?.id || null;
        toast.success("Provider added successfully!");
      }

      if (providerId) {
        setCustomModelsMap((prev) => ({
          ...prev,
          [providerId!]: formAvailableModels,
        }));
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

  const handleFetchModelsInForm = async () => {
    if (!form.baseUrl) {
      toast.error("Isi Base URL / Endpoint terlebih dahulu.");
      return;
    }
    setIsFetchingFormModels(true);
    try {
      const res = await apiFetch(`${API_BASE}/providers/fetch-models`, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
        }),
      });
      const data = await res.json();
      const fetchedModels: string[] = data.data?.models || [];

      if (fetchedModels.length > 0) {
        setFormAvailableModels((prev) => Array.from(new Set([...fetchedModels, ...prev])));
        if (!fetchedModels.includes(form.model)) {
          setForm((f) => ({ ...f, model: fetchedModels[0] }));
        }
        toast.success(`Berhasil menarik ${fetchedModels.length} model otomatis dari API!`);
      } else {
        toast.info("API tersambung tetapi tidak mengembalikan daftar model.");
      }
    } catch (err: any) {
      toast.error(`Gagal mengambil model: ${err.message}`);
    } finally {
      setIsFetchingFormModels(false);
    }
  };

  const handleAddFormCustomModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = formNewModelInput.trim();
    if (!clean) return;

    setFormAvailableModels((prev) => Array.from(new Set([clean, ...prev])));
    setForm((f) => ({ ...f, model: clean }));
    setIsAddingFormModel(false);
    setFormNewModelInput("");
    toast.success(`Model ${clean} ditambahkan dan dipilih.`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Custom LLM Provider Catalogs</h3>
          <p className="text-xs text-[#A3A3A3]">
            Manage provider credentials, API endpoints, and model catalog settings.
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

      {/* Add Provider Form (ONLY when adding a NEW provider) */}
      {showAddForm && !editingId && (
        <ProviderForm
          form={form}
          setForm={setForm}
          formAvailableModels={formAvailableModels}
          providerTypes={PROVIDER_TYPES}
          isEditing={false}
          isTestingForm={isTestingForm}
          isFetchingFormModels={isFetchingFormModels}
          isAddingFormModel={isAddingFormModel}
          setIsAddingFormModel={setIsAddingFormModel}
          formNewModelInput={formNewModelInput}
          setFormNewModelInput={setFormNewModelInput}
          onTypeChange={handleTypeChange}
          onToggleModelSelection={handleToggleModelSelection}
          onFetchModels={handleFetchModelsInForm}
          onAddCustomModelSubmit={handleAddFormCustomModelSubmit}
          onTestConnection={handleTestFormConnection}
          onSubmit={handleSave}
          onCancel={resetForm}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => {
            const isBeingEdited = editingId === p.id;
            const result = testResults[p.id];

            if (isBeingEdited) {
              return (
                <ProviderForm
                  key={p.id}
                  form={form}
                  setForm={setForm}
                  formAvailableModels={formAvailableModels}
                  providerTypes={PROVIDER_TYPES}
                  isEditing={true}
                  isTestingForm={isTestingForm}
                  isFetchingFormModels={isFetchingFormModels}
                  isAddingFormModel={isAddingFormModel}
                  setIsAddingFormModel={setIsAddingFormModel}
                  formNewModelInput={formNewModelInput}
                  setFormNewModelInput={setFormNewModelInput}
                  onTypeChange={handleTypeChange}
                  onToggleModelSelection={handleToggleModelSelection}
                  onFetchModels={handleFetchModelsInForm}
                  onAddCustomModelSubmit={handleAddFormCustomModelSubmit}
                  onTestConnection={handleTestFormConnection}
                  onSubmit={handleSave}
                  onCancel={resetForm}
                />
              );
            }

            return (
              <ProviderCard
                key={p.id}
                provider={p}
                testResult={result}
                isTesting={testingId === p.id}
                onToggleActive={handleToggleActive}
                onTestConnection={handleTestConnection}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
