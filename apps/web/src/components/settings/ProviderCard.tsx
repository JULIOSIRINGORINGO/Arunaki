import { Loader2, Wifi, Trash2, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Provider } from "./ModelProviderSettings";

interface ProviderCardProps {
  provider: Provider;
  testResult?: { success: boolean; status?: number; error?: string; timeMs?: number };
  isTesting: boolean;
  onToggleActive: (p: Provider) => void;
  onTestConnection: (id: string) => void;
  onEdit: (p: Provider) => void;
  onDelete: (id: string) => void;
}

export function ProviderCard({
  provider: p,
  testResult: result,
  isTesting,
  onToggleActive,
  onTestConnection,
  onEdit,
  onDelete,
}: ProviderCardProps) {
  const getSelectedModels = (modelStr: string): string[] => {
    if (!modelStr) return [];
    return modelStr.split(",").map((s) => s.trim()).filter(Boolean);
  };

  return (
    <div
      className={cn(
        "p-3.5 rounded-xl border transition-all space-y-2",
        p.active
          ? "bg-[var(--bg-panel)] border-[var(--border-strong)]"
          : "bg-[var(--bg-card)] border-[var(--border-color)] opacity-90 hover:opacity-100"
      )}
    >
      {/* Clean 2-Line Provider Card Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onToggleActive(p)}
            title={p.active ? "Provider Utama (Aktif)" : "Jadikan Provider Utama"}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border shrink-0 mt-0.5",
              p.active
                ? "bg-[var(--text-primary)] text-[var(--bg-app)] border-[var(--text-primary)]"
                : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-[var(--border-strong)]"
            )}
          >
            <Check className={cn("w-3.5 h-3.5", p.active && "stroke-[3]")} />
            <span>{p.active ? "Provider Utama" : "Set Utama"}</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[var(--text-primary)] text-sm">{p.name}</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded text-[var(--text-muted)]">
                {p.type}
              </span>
              {result && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 font-mono",
                    result.success
                      ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", result.success ? "bg-emerald-500" : "bg-red-400")} />
                  {result.success ? `success (${result.timeMs}ms)` : `failed (${result.error || result.status})`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-[11px] text-[var(--text-dim)] font-mono">
                {p.baseUrl || "Default API Endpoint"}
              </p>
              {p.model && (
                <span className="text-[10px] text-[var(--text-muted)] font-mono px-1.5 py-0.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded">
                  Model Pool ({getSelectedModels(p.model).length}): {p.model}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onTestConnection(p.id)}
            disabled={isTesting}
            className="px-2.5 py-1 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-primary)] border border-[var(--border-strong)] text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            {isTesting ? <Loader2 className="w-3 h-3 animate-spin text-[var(--text-primary)]" /> : <Wifi className="w-3 h-3 text-[var(--text-muted)]" />}
            <span>{isTesting ? "Testing..." : "Tes"}</span>
          </button>
          <button
            onClick={() => onEdit(p)}
            className="px-2.5 py-1 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-strong)] text-[11px] rounded-lg transition-colors cursor-pointer font-medium"
          >
            Sunting Model
          </button>
          <button
            onClick={() => onDelete(p.id)}
            className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
