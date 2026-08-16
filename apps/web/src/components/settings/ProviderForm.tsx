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
        "p-5 bg-[#181818] rounded-xl space-y-4 shadow-xl border",
        isEditing ? "border-white" : "border-[#262626]"
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
        <div>
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-white" />
            {isEditing
              ? `Sunting Model Provider: ${form.name}`
              : "Tambah Provider Connection Baru"}
          </h4>
          <p className="text-[10px] text-[#A3A3A3] mt-0.5 font-mono">{form.baseUrl}</p>
        </div>
        <span className="text-[10px] text-[#A3A3A3]">
          {isEditing ? "Pilih Model Aktif" : "Simpan URL & API Key"}
        </span>
      </div>

      {!isEditing && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">Provider Type</label>
              <select
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value)}
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#525252]"
              >
                {providerTypes.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="http://localhost:20128/v1"
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#A3A3A3] mb-1 font-medium">API Key</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-... (Kosongkan jika local proxy tanpa key)"
                className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
              />
            </div>
          </div>
        </>
      )}

      {/* Integrated Available Models Selector */}
      <div className="pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-[#A3A3A3]" />
            Available Models ({formAvailableModels.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFetchModels}
              disabled={isFetchingFormModels}
              className="px-2.5 py-1 bg-[#262626] hover:bg-[#333333] text-white border border-[#333333] text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
              title="Ambil daftar semua model yang tersedia secara otomatis dari API Provider"
            >
              <RefreshCw className={cn("w-3 h-3 text-[#A3A3A3]", isFetchingFormModels && "animate-spin")} />
              <span>{isFetchingFormModels ? "Syncing..." : "Sync Models dari API"}</span>
            </button>
            <span className="text-[10px] text-[#737373]">
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
                      ? "bg-[#262626] border-white text-white shadow-xs"
                      : "bg-[#121212] border-[#262626] text-[#A3A3A3] hover:text-white hover:border-[#333333]"
                  )}
                >
                  <div className="truncate pr-2">
                    <span className="font-mono text-xs block truncate font-medium">{m}</span>
                    <span className="text-[9px] text-[#737373]">
                      {isPrimary
                        ? "● Primary Active"
                        : isSelected
                        ? "✓ Fallback Active"
                        : "Klik untuk pilih"}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white shrink-0 stroke-[3]" />}
                </button>
              );
            })}

            {isAddingFormModel ? (
              <div className="flex items-center gap-1 bg-[#121212] p-1.5 rounded-lg border border-[#333333]">
                <input
                  type="text"
                  value={formNewModelInput}
                  onChange={(e) => setFormNewModelInput(e.target.value)}
                  placeholder="Nama model baru..."
                  autoFocus
                  className="w-full bg-transparent text-xs text-white px-1.5 focus:outline-none placeholder-[#737373] font-mono"
                />
                <button
                  type="button"
                  onClick={onAddCustomModelSubmit}
                  className="px-2 py-1 bg-white text-black text-[10px] font-bold rounded cursor-pointer shrink-0"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingFormModel(false)}
                  className="px-1 text-xs text-[#A3A3A3] hover:text-white cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setIsAddingFormModel(true); setFormNewModelInput(""); }}
                className="p-2.5 rounded-lg border border-dashed border-[#333333] hover:border-[#525252] text-[#A3A3A3] hover:text-white flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer bg-[#121212]/50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Model</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-[#262626]">
        <button
          type="button"
          onClick={onTestConnection}
          disabled={isTestingForm}
          className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] text-white text-xs rounded-lg font-medium cursor-pointer flex items-center gap-1.5 border border-[#333333] transition-colors"
        >
          {isTestingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Wifi className="w-3.5 h-3.5 text-[#A3A3A3]" />}
          <span>{isTestingForm ? "Testing Ping..." : "Test Connection"}</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] text-white text-xs rounded-lg font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-white text-black hover:bg-[#E5E5E5] text-xs rounded-lg font-bold cursor-pointer"
          >
            Save Provider
          </button>
        </div>
      </div>
    </form>
  );
}
