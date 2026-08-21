import { useState } from "react";
import { Loader2, Wifi, Trash2, Check, ArrowUp, ArrowDown, Settings2, Info, X, Terminal } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Provider } from "./ModelProviderSettings";

interface ProviderCardProps {
  provider: Provider;
  index: number;
  totalProviders: number;
  testResult?: { success: boolean; status?: number; error?: string; reply?: string; model?: string; timeMs?: number };
  isTesting: boolean;
  onToggleActive: (p: Provider) => void;
  onMovePriority?: (index: number, direction: "up" | "down") => void;
  onTestConnection: (id: string) => void;
  onEdit: (p: Provider) => void;
  onDelete: (id: string) => void;
}

export function ProviderCard({
  provider: p,
  index,
  totalProviders,
  testResult: result,
  isTesting,
  onToggleActive,
  onMovePriority,
  onTestConnection,
  onEdit,
  onDelete,
}: ProviderCardProps) {
  const [showTestDetails, setShowTestDetails] = useState(false);

  const getSelectedModels = (modelStr: string): string[] => {
    if (!modelStr) return [];
    return modelStr.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const selectedModels = getSelectedModels(p.model);

  return (
    <div
      className={cn(
        "p-4 rounded-2xl border transition-all space-y-3",
        p.active
          ? "bg-[var(--bg-panel)] border-[var(--border-strong)] shadow-xs"
          : "bg-[var(--bg-card)] border-[var(--border-color)] opacity-90 hover:opacity-100"
      )}
    >
      {/* Top Row: Priority Controls, Primary Status, Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* Priority Reordering Buttons */}
          {onMovePriority && totalProviders > 1 && (
            <div className="flex flex-col gap-1 items-center justify-center pt-0.5 shrink-0">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMovePriority(index, "up")}
                className="p-1 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 cursor-pointer transition-colors"
                title="Move provider up in routing priority"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index === totalProviders - 1}
                onClick={() => onMovePriority(index, "down")}
                className="p-1 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 cursor-pointer transition-colors"
                title="Move provider down in routing priority"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Primary Activation Toggle */}
          <button
            type="button"
            onClick={() => onToggleActive(p)}
            title={p.active ? "Primary active provider" : "Set as primary routing provider"}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 mt-0.5 shadow-xs",
              p.active
                ? "bg-[var(--text-primary)] text-[var(--bg-app)] border-[var(--text-primary)]"
                : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-[var(--border-strong)]"
            )}
          >
            <Check className={cn("w-3.5 h-3.5", p.active && "stroke-[3]")} />
            <span>{p.active ? "Primary Active" : "Set Primary"}</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-[var(--text-primary)] text-sm">{p.name}</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-md text-[var(--text-muted)]">
                {p.type}
              </span>

              {/* Clickable Inline Test Result Badge */}
              {result && (
                <button
                  type="button"
                  onClick={() => setShowTestDetails(!showTestDetails)}
                  title="Click to view ping payload & LLM response details"
                  className={cn(
                    "text-[10px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-mono cursor-pointer transition-all hover:scale-105",
                    result.success
                      ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", result.success ? "bg-emerald-500" : "bg-red-400")} />
                  <span>{result.success ? `Connected (${result.timeMs}ms)` : `Failed: ${result.error || result.status}`}</span>
                  <Info className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <p className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-[280px]">
                {p.baseUrl || "Default Endpoint"}
              </p>
              {p.model && (
                <span className="text-[10px] text-[var(--text-primary)] font-mono px-2 py-0.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-md">
                  Model Pool ({selectedModels.length}): {p.model}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onTestConnection(p.id)}
            disabled={isTesting}
            className="px-3 py-1.5 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] border border-[var(--border-strong)] text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 font-medium shadow-xs"
            title="Send live ping request to provider endpoint"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-primary)]" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            )}
            <span>{isTesting ? "Testing..." : "Test Ping"}</span>
          </button>

          <button
            onClick={() => onEdit(p)}
            className="px-3 py-1.5 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] border border-[var(--border-strong)] text-xs rounded-xl transition-colors cursor-pointer font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Settings2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Configure</span>
          </button>

          <button
            onClick={() => onDelete(p.id)}
            className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] rounded-xl cursor-pointer transition-colors"
            title="Delete provider"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* EXPANDABLE TEST RESULT INSPECTION CARD */}
      {result && showTestDetails && (
        <div className="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-strong)] text-xs font-mono space-y-2 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-1.5">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Live Ping Inspection Details
            </span>
            <button
              type="button"
              onClick={() => setShowTestDetails(false)}
              className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-[var(--text-muted)] block">Prompt Sent:</span>
              <p className="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] text-[var(--text-primary)] mt-0.5">
                "Reply with exactly: ok"
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block">LLM Reply Received:</span>
              <p className="p-1.5 bg-[var(--bg-card)] rounded border border-[var(--border-color)] text-[var(--text-primary)] font-semibold mt-0.5">
                {result.reply ? `"${result.reply}"` : result.error || "No text content"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)] pt-1">
            <span>Latency: <strong className="text-[var(--text-primary)]">{result.timeMs}ms</strong></span>
            <span>Status: <strong className="text-[var(--text-primary)]">HTTP {result.status || (result.success ? 200 : 500)}</strong></span>
            <span>Endpoint: <strong className="text-[var(--text-primary)] truncate">{p.baseUrl}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
