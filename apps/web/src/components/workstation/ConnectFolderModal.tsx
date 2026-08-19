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
      toast.success(`Folder connected: ${newWs.name}`);
      onRefreshWorkspaces();
    } catch {
      toast.error("Failed to connect workspace folder");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl max-w-md w-full p-5 border border-[var(--border-strong)] shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)] mb-4">
          <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[var(--text-muted)]" />
            Connect Workspace Folder
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConnectFolderSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">
              Local Folder Path
            </label>
            <input
              type="text"
              value={folderInputPath}
              onChange={(e) => setFolderInputPath(e.target.value)}
              placeholder="Example: E:\DocumentWorkspaces\Garment"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          {workspaces.length > 0 && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">
                Or Select Recent Workspace:
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      onClose();
                      toast.success(`Connected to ${ws.name}`);
                    }}
                    className="p-2 rounded-md bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] transition-colors cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-[var(--text-primary)] truncate">{ws.name}</span>
                    <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[150px]">
                      {ws.rootPath}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--bg-hover)] hover:opacity-80 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 rounded-md text-xs font-semibold cursor-pointer transition-opacity"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
