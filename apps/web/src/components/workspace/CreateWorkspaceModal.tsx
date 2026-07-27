/* Hallmark · component: create-workspace-modal · genre: atmospheric · theme: Studio */
import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Building2 } from "lucide-react";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, businessType?: string) => void;
  isLoading?: boolean;
}

const DOMAIN_TEMPLATES = [
  { id: "generic", label: "Umum / Generic" },
  { id: "garment", label: "Garment & Tekstil" },
  { id: "restaurant", label: "Restoran / Kuliner" },
  { id: "retail", label: "Retail / Toko" },
  { id: "manufaktur", label: "Manufaktur / Pabrik" },
  { id: "apotek", label: "Apotek / Farmasi" },
  { id: "bengkel", label: "Bengkel / Otomotif" },
  { id: "laundry", label: "Laundry / Jasa Cuci" },
  { id: "minimarket", label: "Minimarket / Kelontong" },
  { id: "distributor", label: "Distributor / Supplier" },
  { id: "percetakan", label: "Percetakan / Printing" },
  { id: "petshop", label: "Petshop / Grooming" },
  { id: "salon", label: "Salon / Spa Kecantikan" },
  { id: "kontraktor", label: "Kontraktor / Konstruksi" },
  { id: "ekspedisi", label: "Ekspedisi / Logistik" },
];

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("generic");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), businessType);
      setName("");
      setBusinessType("generic");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface-100 border border-surface-200 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Sparkles className="text-accent" size={14} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-surface-900">
                Buat Workspace
              </h2>
              <p className="text-[11px] text-surface-500">
                Workspace baru untuk bisnis Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-surface-600 mb-1.5">
              Nama Workspace
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Garment Production Q3"
              className="w-full px-3 py-2.5 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 placeholder:text-surface-500 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-150"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-surface-600 mb-1.5 flex items-center gap-1.5">
              <Building2 size={13} className="text-surface-500" />
              Industri / Domain Bisnis
            </label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-200 border border-surface-300 rounded-lg text-[13px] text-surface-900 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-150"
            >
              {DOMAIN_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2.5 mt-5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-[13px] font-medium text-surface-600 hover:bg-surface-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="px-4 py-2 bg-accent text-surface-100 rounded-lg hover:bg-accent-dim disabled:opacity-30 disabled:cursor-not-allowed text-[13px] font-medium transition-all duration-150 active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-surface-100/30 border-t-surface-100 rounded-full animate-spin" />
                  Membuat...
                </span>
              ) : (
                "Buat"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
