import React from "react";
import { Plus, Check, Loader2, Wifi, Bot, Settings2, RefreshCw } from "lucide-react";
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

interface ProviderFormProps {
  form: ProviderFormData;
  setForm: React.Dispatch<React.SetStateAction<ProviderFormData>>;
  formAvailableModels: string[];
  providerTypes: Array<{ value: string; label: string; defaultUrl: string }>;
  isEditing: boolean;
  isTestingForm: boolean;
  isFetchingFormModels: boolean;
  isAddingFormModel: boolean;
  setIsAddingFormModel: (val: boolean) => void;
  formNewModelInput: string;
  setFormNewModelInput: (val: string) => void;
  onTypeChange: (type: string) => void;
  onToggleModelSelection: (model: string) => void;
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
  isFetchingFormModels,
  isAddingFormModel,
  setIsAddingFormModel,
  formNewModelInput,
  setFormNewModelInput,
  onTypeChange,
  onToggleModelSelection,
  onFetchModels,
  onAddCustomModelSubmit,
  onTestConnection,
  onSubmit,
  onCancel,
}: ProviderFormProps) {
  const getSelectedModels = (modelStr: string): string[] => {
    if (!modelStr) return [];
    return modelStr.split(",").map((s) => s.trim()).filter(Boolean);
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "p-5 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl space-y-4 shadow-xl border",
        isEditing ? "border-[var(--text-primary)]" : "border-[var(--border-color)]"
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
        <div>
          <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[var(--text-primary)]" />
            {isEditing
              ? `Sunting Model Provider: ${form.name}`
              : "Tambah Provider Connection Baru"}
          </h4>
          <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-mono">{form.baseUrl}</p>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">
          {isEditing ? "Pilih Model Aktif" : "Simpan URL & API Key"}
        </span>
      </div>

      {!isEditing && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">Provider Type</label>
              <select
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
              >
                {providerTypes.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Kenari.id / 9Router Local / OpenRouter"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">Base URL / Endpoint</label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="http://localhost:20128/v1"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1 font-medium">API Key</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-... (Kosongkan jika local proxy tanpa key)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)]"
              />
            </div>
          </div>
        </>
      )}

      {/* Integrated Available Models Selector */}
      <div className="pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Available Models ({formAvailableModels.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFetchModels}
              disabled={isFetchingFormModels}
              className="px-2.5 py-1 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] border border-[var(--border-strong)] text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
              title="Ambil daftar semua model yang tersedia secara otomatis dari API Provider"
            >
              <RefreshCw className={cn("w-3 h-3 text-[var(--text-muted)]", isFetchingFormModels && "animate-spin")} />
              <span>{isFetchingFormModels ? "Syncing..." : "Sync Models dari API"}</span>
            </button>
            <span className="text-[10px] text-[var(--text-dim)]">
              {getSelectedModels(form.model).length > 1
                ? `Pool (${getSelectedModels(form.model).length} model terpilih)`
                : "Klik model untuk memilih 1 atau lebih model aktif"}
            </span>
          </div>
        </div>

        <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {formAvailableModels.map((m) => {
              const selectedList = getSelectedModels(form.model);
              const isSelected = selectedList.includes(m);
              const isPrimary = selectedList[0] === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onToggleModelSelection(m)}
                  className={cn(
                    "p-2.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer",
                    isSelected
                      ? "bg-[var(--bg-hover)] border-[var(--text-primary)] text-[var(--text-primary)] shadow-xs"
                      : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <div className="truncate pr-2">
                    <span className="font-mono text-xs block truncate font-medium">{m}</span>
                    <span className="text-[9px] text-[var(--text-dim)]">
                      {isPrimary
                        ? "● Primary Active"
                        : isSelected
                        ? "✓ Fallback Active"
                        : "Klik untuk pilih"}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[var(--text-primary)] shrink-0 stroke-[3]" />}
                </button>
              );
            })}

            {isAddingFormModel ? (
              <div className="flex items-center gap-1 bg-[var(--bg-input)] p-1.5 rounded-lg border border-[var(--border-strong)]">
                <input
                  type="text"
                  value={formNewModelInput}
                  onChange={(e) => setFormNewModelInput(e.target.value)}
                  placeholder="Nama model baru..."
                  autoFocus
                  className="w-full bg-transparent text-xs text-[var(--text-primary)] px-1.5 focus:outline-none placeholder-[var(--text-dim)] font-mono"
                />
                <button
                  type="button"
                  onClick={onAddCustomModelSubmit}
                  className="px-2 py-1 bg-[var(--text-primary)] text-[var(--bg-app)] text-[10px] font-bold rounded cursor-pointer shrink-0"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingFormModel(false)}
                  className="px-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setIsAddingFormModel(true); setFormNewModelInput(""); }}
                className="p-2.5 rounded-lg border border-dashed border-[var(--border-strong)] hover:border-[var(--text-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer bg-[var(--bg-input)]/50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Model</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
        <button
          type="button"
          onClick={onTestConnection}
          disabled={isTestingForm}
          className="px-3 py-1.5 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] text-xs rounded-lg font-medium cursor-pointer flex items-center gap-1.5 border border-[var(--border-strong)] transition-colors"
        >
          {isTestingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-primary)]" /> : <Wifi className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          <span>{isTestingForm ? "Testing Ping..." : "Test Connection"}</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] text-xs rounded-lg font-medium cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 text-xs rounded-lg font-bold cursor-pointer transition-opacity"
          >
            Save Provider
          </button>
        </div>
      </div>
    </form>
  );
}
