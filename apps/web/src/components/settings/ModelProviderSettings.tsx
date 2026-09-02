import { useState, useEffect } from "react";
import { Plus, Loader2, Cpu, Info } from "lucide-react";
import { API_BASE, apiFetch, directoryQuery } from "../../lib/api";
import { toast } from "sonner";
import { ProviderCard } from "./ProviderCard";
import { ProviderForm, type ProviderFormData, type FormTestResult } from "./ProviderForm";

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
  { value: "groq", label: "Groq Cloud (Ultra-Fast LPU)", defaultUrl: "https://api.groq.com/openai/v1" },
  { value: "gemini", label: "Google Gemini (Official / Vertex)", defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { value: "deepseek", label: "DeepSeek Official", defaultUrl: "https://api.deepseek.com/v1" },
  { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "kenari", label: "Kenari Cloud", defaultUrl: "https://api.kenari.id/v1" },
  { value: "openai", label: "OpenAI Official", defaultUrl: "https://api.openai.com/v1" },
  { value: "anthropic", label: "Anthropic Official", defaultUrl: "https://api.anthropic.com/v1" },
  { value: "mistral", label: "Mistral AI Official", defaultUrl: "https://api.mistral.ai/v1" },
  { value: "together", label: "Together AI", defaultUrl: "https://api.together.xyz/v1" },
  { value: "cohere", label: "Cohere (Command R+)", defaultUrl: "https://api.cohere.com/v2" },
  { value: "ollama", label: "Ollama (Local Host)", defaultUrl: "http://localhost:11434/v1" },
  { value: "lmstudio", label: "LM Studio (Local Host)", defaultUrl: "http://localhost:1234/v1" },
  { value: "9router", label: "9Router (Local Gateway)", defaultUrl: "http://localhost:20128/v1" },
  { value: "openai-compatible", label: "Other (Custom Endpoint)", defaultUrl: "" },
];

const DEFAULT_MODELS: Record<string, string[]> = {
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "deepseek-r1-distill-llama-70b",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ],
  gemini: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash-thinking-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  openrouter: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "google/gemini-2.5-flash",
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o",
    "meta-llama/llama-4-maverick:free",
  ],
  kenari: [
    "gpt-oss-120b",
    "deepseek-v4-flash:free",
    "deepseek-v4-flash",
    "llama-3-1-70b-instruct",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini", "gpt-4-turbo"],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
  ],
  mistral: [
    "mistral-large-latest",
    "mistral-small-latest",
    "codestral-latest",
    "ministral-8b-latest",
  ],
  together: [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "deepseek-ai/DeepSeek-R1",
    "Qwen/Qwen2.5-72B-Instruct-Turbo",
  ],
  cohere: ["command-r-plus-08-2024", "command-r-08-2024"],
  ollama: ["llama3.3", "qwen2.5:72b", "deepseek-r1:14b", "mistral", "gemma2"],
  lmstudio: ["local-model"],
  "9router": [
    "cx/gpt-5.6-terra",
    "cx/gpt-5.5",
    "cx/gpt-5.4-mini",
    "cx/gpt-5.6-luna",
    "deepseek-r1",
    "claude-3-5-sonnet",
  ],
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
  const [isTestingForm, setIsTestingForm] = useState(false);
  const [formTestResult, setFormTestResult] = useState<FormTestResult | null>(null);
  const [isFetchingFormModels, setIsFetchingFormModels] = useState(false);
  const [isAddingFormModel, setIsAddingFormModel] = useState(false);
  const [formNewModelInput, setFormNewModelInput] = useState("");
  const [testResults, setTestResults] = useState<Record<string, FormTestResult>>({});

  // Custom Models per Provider Map (persisted in localStorage)
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
    setFormTestResult(null);
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
        toast.info("At least 1 model must remain selected in the routing pool.");
        return;
      }
      updated = current.filter((id) => id !== m);
    } else {
      updated = [...current, m];
    }
    setForm((f) => ({ ...f, model: updated.join(", ") }));
  };

  const handleReorderModels = (newOrder: string[]) => {
    setForm((f) => ({ ...f, model: newOrder.join(", ") }));
  };

  const handleTypeChange = (type: string) => {
    const pt = PROVIDER_TYPES.find((p) => p.value === type);
    const defaults = DEFAULT_MODELS[type] || DEFAULT_MODELS["openai-compatible"] || [];
    const defaultModel = defaults[0] || "";
    setForm((f) => ({
      ...f,
      type,
      baseUrl: type === "openai-compatible" ? "" : (pt?.defaultUrl ?? ""),
      model: defaultModel,
      name: pt?.label || f.name,
    }));
    setFormAvailableModels(defaults);
    setFormTestResult(null);
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
    setFormTestResult(null);
    setShowAddForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let providerId = editingId;
      if (editingId) {
        await apiFetch(`${API_BASE}/providers/${editingId}${directoryQuery()}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Provider connection updated successfully.");
      } else {
        const res = await apiFetch(`${API_BASE}/providers${directoryQuery()}`, {
          method: "POST",
          body: JSON.stringify(form),
        });
        const data = await res.json();
        providerId = data.data?.id || null;
        toast.success("New provider added successfully.");
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
      toast.error("Failed to save provider configuration.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider configuration?")) return;
    try {
      await apiFetch(`${API_BASE}/providers/${id}${directoryQuery()}`, { method: "DELETE" });
      toast.success("Provider deleted successfully.");
      onRefresh();
    } catch {
      toast.error("Failed to delete provider.");
    }
  };

  const handleToggleActive = async (provider: Provider) => {
    try {
      await apiFetch(`${API_BASE}/providers/${provider.id}/state${directoryQuery()}`, {
        method: "PUT",
        body: JSON.stringify({ active: !provider.active }),
      });
      toast.success(`Provider ${provider.active ? "deactivated" : "set as primary"}`);
      onRefresh();
    } catch {
      toast.error("Failed to update provider status.");
    }
  };

  const handleMoveProviderPriority = async (index: number, direction: "up" | "down") => {
    const list = [...providers];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const currentP = list[index];
    const targetP = list[targetIdx];

    try {
      // Swap priorities
      await Promise.all([
        apiFetch(`${API_BASE}/providers/${currentP.id}/state${directoryQuery()}`, {
          method: "PUT",
          body: JSON.stringify({ priority: targetP.priority ?? targetIdx }),
        }),
        apiFetch(`${API_BASE}/providers/${targetP.id}/state${directoryQuery()}`, {
          method: "PUT",
          body: JSON.stringify({ priority: currentP.priority ?? index }),
        }),
      ]);
      toast.success("Routing priority updated.");
      onRefresh();
    } catch {
      toast.error("Failed to update provider priority.");
    }
  };

  const handleFetchModelsInForm = async () => {
    if (!form.baseUrl) {
      toast.error("Please enter a valid Base URL / Endpoint first.");
      return;
    }
    setIsFetchingFormModels(true);
    try {
      const res = await apiFetch(`${API_BASE}/providers/fetch-models${directoryQuery()}`, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
        }),
      });
      const data = await res.json();
      const fetchedModels: string[] = data.data?.models || [];

      if (fetchedModels.length === 0) {
        toast.info("No models discovered from endpoint. Keeping default catalog.");
        return;
      }

      const existingSelected = getSelectedModels(form.model);
      const combined = Array.from(new Set([...existingSelected, ...fetchedModels]));
      setFormAvailableModels(combined);
      toast.success(`Discovered ${fetchedModels.length} models from endpoint!`);
    } catch (err: any) {
      toast.error(`Sync models failed: ${err.message}`);
    } finally {
      setIsFetchingFormModels(false);
    }
  };

  const handleAddCustomModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = formNewModelInput.trim();
    if (!clean) return;

    setFormAvailableModels((prev) => Array.from(new Set([clean, ...prev])));
    setForm((f) => ({ ...f, model: clean }));
    setIsAddingFormModel(false);
    setFormNewModelInput("");
    toast.success(`Model "${clean}" added to selection.`);
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    const startMs = Date.now();
    try {
      const res = await apiFetch(`${API_BASE}/providers/${id}/test${directoryQuery()}`, { method: "POST" });
      const data = await res.json();
      const elapsed = Date.now() - startMs;
      const isOk = data.data?.success;
      const reply = data.data?.reply || "";
      const prompt = data.data?.prompt || "Hello, connection test.";

      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: !!isOk,
          status: data.data?.status || (isOk ? 200 : 500),
          error: data.data?.error,
          prompt: prompt,
          reply: reply,
          timeMs: elapsed,
        },
      }));

      if (isOk) {
        toast.success(`Connection Test Passed! (${elapsed}ms) ${reply ? `— "${reply}"` : ""}`);
      } else {
        toast.error(`Connection Test Failed: ${data.data?.error || "Endpoint unreachable"}`);
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, error: err.message },
      }));
      toast.error(`Connection Test Failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleTestFormConnection = async () => {
    setIsTestingForm(true);
    const startMs = Date.now();
    try {
      const res = await apiFetch(`${API_BASE}/providers/test${directoryQuery()}`, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model ? form.model.split(",")[0].trim() : "",
        }),
      });
      const data = await res.json();
      const elapsed = Date.now() - startMs;
      const isOk = data.data?.success;
      const reply = data.data?.reply || "";
      const prompt = data.data?.prompt || "Hello, connection test.";

      const result: FormTestResult = {
        success: !!isOk,
        status: data.data?.status || (isOk ? 200 : 500),
        error: data.data?.error,
        prompt: prompt,
        reply: reply,
        model: data.data?.model,
        timeMs: elapsed,
      };

      setFormTestResult(result);

      if (isOk) {
        toast.success(`Ping Successful! (${elapsed}ms) ${reply ? `— "${reply}"` : ""}`);
      } else {
        toast.error(`Ping Failed: ${data.data?.error || "Endpoint unreachable"}`);
      }
    } catch (err: any) {
      setFormTestResult({ success: false, error: err.message });
      toast.error(`Ping Error: ${err.message}`);
    } finally {
      setIsTestingForm(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Description & Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--text-primary)]" />
            Language Model Routing & Provider Catalogs
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage provider credentials, API endpoints, and fallback model priority order.
          </p>
        </div>

        {!showAddForm && (
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Provider</span>
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start gap-3 text-xs text-[var(--text-muted)] leading-relaxed">
        <Info className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[var(--text-primary)] font-semibold">Automatic Fallback Routing:</strong> When executing document tasks, Arunaki routes to the primary active model. If an endpoint encounters rate limits or errors, it automatically falls back sequentially to subsequent models in the pool without interrupting your workflow.
        </div>
      </div>

      {/* Form (Add or Edit) */}
      {showAddForm && (
        <ProviderForm
          form={form}
          setForm={setForm}
          formAvailableModels={formAvailableModels}
          providerTypes={PROVIDER_TYPES}
          isEditing={!!editingId}
          isTestingForm={isTestingForm}
          testResult={formTestResult}
          isFetchingFormModels={isFetchingFormModels}
          isAddingFormModel={isAddingFormModel}
          setIsAddingFormModel={setIsAddingFormModel}
          formNewModelInput={formNewModelInput}
          setFormNewModelInput={setFormNewModelInput}
          onTypeChange={handleTypeChange}
          onToggleModelSelection={handleToggleModelSelection}
          onReorderModels={handleReorderModels}
          onFetchModels={handleFetchModelsInForm}
          onAddCustomModelSubmit={handleAddCustomModelSubmit}
          onTestConnection={handleTestFormConnection}
          onSubmit={handleSave}
          onCancel={resetForm}
        />
      )}

      {/* List of Configured Providers */}
      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-primary)]" />
          <span>Loading provider configurations...</span>
        </div>
      ) : providers.length === 0 ? (
        <div className="p-8 text-center bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] space-y-3">
          <Cpu className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="text-xs text-[var(--text-muted)]">No model providers configured yet.</p>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] rounded-xl text-xs font-semibold cursor-pointer"
          >
            + Add First Provider
          </button>
        </div>
      ) : (
        <div className="space-y-3 w-full">
          {providers.map((p, idx) => (
            <ProviderCard
              key={p.id}
              provider={p}
              index={idx}
              totalProviders={providers.length}
              testResult={testResults[p.id]}
              isTesting={testingId === p.id}
              onToggleActive={handleToggleActive}
              onMovePriority={handleMoveProviderPriority}
              onTestConnection={handleTestConnection}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
