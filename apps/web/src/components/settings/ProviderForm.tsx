import React, { useState, useMemo } from "react";
import { Plus, Check, Loader2, Wifi, Bot, Settings2, RefreshCw, Search, ArrowUp, ArrowDown, X, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ProviderFormData {
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headerPrefix?: string;
  headerTitle?: string;
}

export interface FormTestResult {
  success: boolean;
  status?: number;
  error?: string;
  prompt?: string;
  reply?: string;
  model?: string;
  timeMs?: number;
}

interface ProviderFormProps {
  form: ProviderFormData;
  setForm: React.Dispatch<React.SetStateAction<ProviderFormData>>;
  formAvailableModels: string[];
  providerTypes: Array<{ value: string; label: string; defaultUrl: string }>;
  isEditing: boolean;
  isTestingForm: boolean;
  testResult: FormTestResult | null;
  isFetchingFormModels: boolean;
  isAddingFormModel: boolean;
  setIsAddingFormModel: (val: boolean) => void;
  formNewModelInput: string;
  setFormNewModelInput: (val: string) => void;
  onTypeChange: (type: string) => void;
  onToggleModelSelection: (model: string) => void;
  onReorderModels: (newOrder: string[]) => void;
  onFetchModels: () => void;
  onAddCustomModelSubmit: (e: React.FormEvent) => void;
  onTestConnection: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function ProviderForm({
  form,
  setForm,
  formAvailableModels,
  providerTypes,
  isEditing,
  isTestingForm,
  testResult,
  isFetchingFormModels,
  isAddingFormModel,
  setIsAddingFormModel,
  formNewModelInput,
  setFormNewModelInput,
  onTypeChange,
  onToggleModelSelection,
  onReorderModels,
  onFetchModels,
  onAddCustomModelSubmit,
  onTestConnection,
  onSubmit,
  onCancel,
}: ProviderFormProps) {
  const [modelSearch, setModelSearch] = useState("");

  const getSelectedModels = (modelStr: string): string[] => {
    if (!modelStr) return [];
    return modelStr.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const selectedModels = useMemo(() => getSelectedModels(form.model), [form.model]);

  // Filter available models via search query
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return formAvailableModels;
    const q = modelSearch.toLowerCase().trim();
    return formAvailableModels.filter((m) => m.toLowerCase().includes(q));
  }, [formAvailableModels, modelSearch]);

  const moveModelPriority = (index: number, direction: "up" | "down") => {
    const list = [...selectedModels];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    onReorderModels(list);
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "p-6 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl space-y-5 border w-full",
        isEditing ? "border-[var(--border-strong)]" : "border-[var(--border-color)]"
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[var(--text-primary)]" />
            {isEditing ? `Configure Provider: ${form.name}` : "Add New Provider Connection"}
          </h4>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">{form.baseUrl || "No endpoint specified"}</p>
        </div>
        <span className="text-xs text-[var(--text-muted)] font-medium">
          {isEditing ? "Select Active Models & Routing" : "Endpoint & Credentials"}
        </span>
      </div>

      {!isEditing && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">Provider Type</label>
              <select
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
              >
                {providerTypes.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kenari Cloud / Local 9Router / OpenRouter"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">Base URL / Endpoint</label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://api.kenari.id/v1"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">API Key / Token</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-... (Leave blank if local gateway)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE MODEL ROUTING PRIORITY (RE-ORDERABLE LIST) */}
      {selectedModels.length > 0 && (
        <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Active Model Routing Priority ({selectedModels.length} selected)
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              Use arrows to adjust fallback order
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedModels.map((m, idx) => (
              <div
                key={m}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-xs font-mono text-[var(--text-primary)] shadow-xs"
              >
                <span className="text-[10px] font-bold text-[var(--text-muted)]">#{idx + 1}</span>
                <span className="font-semibold truncate max-w-[180px]">{m}</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-[var(--bg-app)] rounded text-[var(--text-muted)]">
                  {idx === 0 ? "Primary" : `Fallback ${idx}`}
                </span>

                {/* Priority controls */}
                <div className="flex items-center gap-0.5 ml-1 border-l border-[var(--border-color)] pl-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveModelPriority(idx, "up")}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                    title="Move higher priority"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === selectedModels.length - 1}
                    onClick={() => moveModelPriority(idx, "down")}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                    title="Move lower priority"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  {selectedModels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onToggleModelSelection(m)}
                      className="p-1 text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                      title="Remove from pool"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INTEGRATED AVAILABLE MODELS SELECTOR WITH SEARCH */}
      <div className="pt-2 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Available Models ({filteredModels.length} of {formAvailableModels.length})
          </span>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3 h-3 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search models..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="w-36 sm:w-48 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg pl-7 pr-2.5 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
              />
              {modelSearch && (
                <button
                  type="button"
                  onClick={() => setModelSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onFetchModels}
              disabled={isFetchingFormModels}
              className="px-3 py-1 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] border border-[var(--border-strong)] text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 font-medium shrink-0"
              title="Fetch all available models automatically from API endpoint"
            >
              <RefreshCw className={cn("w-3 h-3 text-[var(--text-muted)]", isFetchingFormModels && "animate-spin")} />
              <span>{isFetchingFormModels ? "Syncing..." : "Sync Models from API"}</span>
            </button>
          </div>
        </div>

        {/* Model Grid */}
        <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2">
          {filteredModels.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)]">
              No models match "{modelSearch}". Try another keyword or add custom model below.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filteredModels.map((m) => {
                const isSelected = selectedModels.includes(m);
                const isPrimary = selectedModels[0] === m;
                const priorityIdx = selectedModels.indexOf(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onToggleModelSelection(m)}
                    className={cn(
                      "p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                      isSelected
                        ? "bg-[var(--bg-hover)] border-[var(--border-strong)] text-[var(--text-primary)] shadow-xs"
                        : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-xs block truncate font-semibold">{m}</span>
                      <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                        {isPrimary
                          ? "● Primary Active"
                          : isSelected
                          ? `✓ Fallback #${priorityIdx}`
                          : "Click to select"}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[var(--text-primary)] shrink-0 stroke-[2.5]" />}
                  </button>
                );
              })}

              {isAddingFormModel ? (
                <div className="flex items-center gap-1.5 bg-[var(--bg-input)] p-2 rounded-xl border border-[var(--border-strong)]">
                  <input
                    type="text"
                    value={formNewModelInput}
                    onChange={(e) => setFormNewModelInput(e.target.value)}
                    placeholder="e.g. gpt-5-pro"
                    autoFocus
                    className="w-full bg-transparent text-xs text-[var(--text-primary)] px-1 focus:outline-none placeholder-[var(--text-dim)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={onAddCustomModelSubmit}
                    className="px-2.5 py-1 bg-[var(--text-primary)] text-[var(--bg-app)] text-xs font-bold rounded-lg cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingFormModel(false)}
                    className="px-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingFormModel(true);
                    setFormNewModelInput("");
                  }}
                  className="p-3 rounded-xl border border-dashed border-[var(--border-strong)] hover:border-[var(--text-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer bg-[var(--bg-input)]/50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Custom Model</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER ACTIONS & TEST CONNECTION STATUS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTestingForm}
            className="px-4 py-2 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] text-xs rounded-xl font-medium cursor-pointer flex items-center gap-2 border border-[var(--border-strong)] transition-colors shadow-xs"
          >
            {isTestingForm ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-primary)]" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            )}
            <span>{isTestingForm ? "Testing Ping..." : "Test Connection"}</span>
          </button>

          {/* Inline Test Result Feedback */}
          {testResult && (
            <div
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 font-mono animate-in fade-in duration-100",
                testResult.success
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              )}
            >
              <span
                className={cn("w-2 h-2 rounded-full", testResult.success ? "bg-emerald-500" : "bg-red-400")}
              />
              <span className="font-semibold">
                {testResult.success
                  ? `✓ Connected (${testResult.timeMs}ms)`
                  : `✕ Failed: ${testResult.error || `HTTP ${testResult.status}`}`}
              </span>
              {testResult.reply && (
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px]">
                  — Reply: "{testResult.reply}"
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs rounded-xl font-medium border border-[var(--border-color)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 text-xs rounded-xl font-semibold transition-all cursor-pointer shadow-xs"
          >
            Save Provider
          </button>
        </div>
      </div>
    </form>
  );
}
