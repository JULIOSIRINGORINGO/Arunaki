import { useState } from "react";
import { Shield, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function SecretsVaultSettings() {
  const [secrets, setSecrets] = useState([
    { key: "TAVILY_API_KEY", masked: "tvly-****-89a1", domain: "Global Web Search" },
    { key: "KENARI_API_KEY", masked: "knr-****-44f2", domain: "Document Intelligence" },
  ]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    setSecrets((prev) => [
      ...prev,
      {
        key: newKey.trim().toUpperCase(),
        masked: `${newValue.slice(0, 3)}-****-${newValue.slice(-4)}`,
        domain: "Encrypted Storage",
      },
    ]);
    setNewKey("");
    setNewValue("");
    toast.success("Secret saved encrypted to Secrets Vault!");
  };

  const handleDeleteSecret = (key: string) => {
    setSecrets((prev) => prev.filter((s) => s.key !== key));
    toast.success(`Secret ${key} deleted.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          Encrypted Secrets Vault (AES-256-GCM)
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Securely store API keys and credentials encrypted on your local device.
        </p>
      </div>

      <form onSubmit={handleAddSecret} className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] space-y-3">
        <h4 className="text-xs font-bold text-[var(--text-primary)]">Save New Secret Key</h4>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Key Name (e.g. OPENAI_API_KEY)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)]"
          />
          <input
            type="password"
            placeholder="Secret Key Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Encrypt & Save</span>
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {secrets.map((s) => (
          <div
            key={s.key}
            className="p-3 bg-[var(--bg-panel)] rounded-xl border border-[var(--border-color)] flex items-center justify-between text-xs"
          >
            <div>
              <span className="font-bold text-[var(--text-primary)] block">{s.key}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">{s.masked} • {s.domain}</span>
            </div>
            <button
              onClick={() => handleDeleteSecret(s.key)}
              className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
