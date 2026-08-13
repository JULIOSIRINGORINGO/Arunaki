import { useState } from "react";
import { FolderOpen, X } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch } from "../../lib/api";

interface Workspace {
  id: string;
  name: string;
  rootPath: string | null;
}

interface ConnectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  onSelectWorkspace: (wsId: string | null) => void;
  onRefreshWorkspaces: () => void;
}

export function ConnectFolderModal({
  isOpen,
  onClose,
  workspaces,
  onSelectWorkspace,
  onRefreshWorkspaces,
}: ConnectFolderModalProps) {
  const [folderInputPath, setFolderInputPath] = useState("");

  if (!isOpen) return null;

  const handleConnectFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderInputPath.trim()) return;
    try {
      const response = await apiFetch(`${API_BASE}/workspaces/connect-folder`, {
        method: "POST",
        body: JSON.stringify({ folderPath: folderInputPath.trim() }),
      });
      const json = await response.json();
      const newWs = json.data;
      onSelectWorkspace(newWs.id);
      onClose();
      setFolderInputPath("");
      toast.success(`Folder terhubung: ${newWs.name}`);
      onRefreshWorkspaces();
    } catch {
      toast.error("Gagal menghubungkan folder workspace");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A191B] text-white rounded-2xl max-w-md w-full p-5 border border-stone-700 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
          <h3 className="font-bold text-sm text-[#F4EFE6] flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#FF5E38]" />
            Hubungkan Folder Workspace
          </h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConnectFolderSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-stone-300 mb-1.5 font-medium">
              Path Folder Lokal
            </label>
            <input
              type="text"
              value={folderInputPath}
              onChange={(e) => setFolderInputPath(e.target.value)}
              placeholder="Contoh: E:\DocumentWorkspaces\Garment"
              className="w-full bg-[#252428] border border-stone-700 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#FF5E38]"
            />
          </div>

          {workspaces.length > 0 && (
            <div>
              <label className="block text-xs text-stone-400 mb-1.5 font-medium">
                Atau Pilih Workspace Terbaru:
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      onClose();
                      toast.success(`Dihubungkan ke ${ws.name}`);
                    }}
                    className="p-2 rounded-xl bg-[#252428] hover:bg-[#2f2e33] border border-stone-800 transition-colors cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-white truncate">{ws.name}</span>
                    <span className="text-[10px] text-stone-400 truncate max-w-[150px]">
                      {ws.rootPath}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#252428] hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#FF5E38] hover:bg-[#e04e2a] text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Hubungkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
