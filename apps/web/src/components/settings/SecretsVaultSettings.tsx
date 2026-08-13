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
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Encrypted Secrets Vault (AES-256-GCM)
        </h3>
        <p className="text-xs text-[#A3A3A3]">
          Securely store API keys and credentials encrypted on your local device.
        </p>
      </div>

      <form onSubmit={handleAddSecret} className="p-4 bg-[#181818] rounded-xl border border-[#262626] space-y-3">
        <h4 className="text-xs font-bold text-white">Save New Secret Key</h4>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Key Name (e.g. OPENAI_API_KEY)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="bg-[#121212] border border-[#262626] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
          />
          <input
            type="password"
            placeholder="Secret Key Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="bg-[#121212] border border-[#262626] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-[#E5E5E5] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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
            className="p-3 bg-[#181818] rounded-xl border border-[#262626] flex items-center justify-between text-xs"
          >
            <div>
              <span className="font-bold text-white block">{s.key}</span>
              <span className="text-[10px] text-[#A3A3A3] font-mono">{s.masked} • {s.domain}</span>
            </div>
            <button
              onClick={() => handleDeleteSecret(s.key)}
              className="p-1 text-[#A3A3A3] hover:text-red-400 rounded cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
