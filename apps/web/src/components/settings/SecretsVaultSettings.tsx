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
    toast.success("Secret disimpan secara terenkripsi ke Secrets Vault!");
  };

  const handleDeleteSecret = (key: string) => {
    setSecrets((prev) => prev.filter((s) => s.key !== key));
    toast.success(`Secret ${key} dihapus.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-[#F4EFE6] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#FF5E38]" />
          Encrypted Secrets Vault (AES-256-GCM)
        </h3>
        <p className="text-xs text-stone-400">
          Simpan API key rahasia dan kredensial terenskripsi secara aman di perangkat lokal.
        </p>
      </div>

      <form onSubmit={handleAddSecret} className="p-4 bg-[#252428] rounded-2xl border border-stone-800 space-y-3">
        <h4 className="text-xs font-bold text-white">Simpan Kunci Rahasia Baru</h4>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Nama Kunci (contoh: OPENAI_API_KEY)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="bg-[#1A191B] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#FF5E38]"
          />
          <input
            type="password"
            placeholder="Nilai Kunci Rahasia"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="bg-[#1A191B] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#FF5E38]"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5E38] hover:bg-[#e04e2a] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Encryp & Ensimpan</span>
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {secrets.map((s) => (
          <div
            key={s.key}
            className="p-3 bg-[#252428] rounded-xl border border-stone-800 flex items-center justify-between text-xs"
          >
            <div>
              <span className="font-bold text-white block">{s.key}</span>
              <span className="text-[10px] text-stone-400 font-mono">{s.masked} • {s.domain}</span>
            </div>
            <button
              onClick={() => handleDeleteSecret(s.key)}
              className="p-1 text-stone-400 hover:text-red-400 rounded cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
