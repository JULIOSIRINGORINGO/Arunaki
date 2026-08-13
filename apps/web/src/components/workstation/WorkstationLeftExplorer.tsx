import { Folder, FolderOpen, Search, X } from "lucide-react";
import FileTree from "../workspace/FileTree";

interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}

interface Workspace {
  id: string;
  name: string;
  rootPath: string | null;
}

interface WorkstationLeftExplorerProps {
  collapsed: boolean;
  onClose: () => void;
  activeWorkspace: Workspace | null;
  workspaceFiles: WorkspaceFile[];
  onOpenFileTab: (path: string, name: string, content?: string) => void;
  onOpenFolderModal: () => void;
}

export function WorkstationLeftExplorer({
  collapsed,
  onClose,
  activeWorkspace,
  workspaceFiles,
  onOpenFileTab,
  onOpenFolderModal,
}: WorkstationLeftExplorerProps) {
  if (collapsed) return null;

  return (
    <aside className="w-64 bg-[#1A191B] text-[#F4EFE6] border-r border-stone-800 flex flex-col shrink-0">
      <div className="p-3 border-b border-stone-800 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-[#C4B5FD] uppercase flex items-center gap-2">
          <Folder className="w-4 h-4 text-[#FF5E38]" />
          EKSPLORE (FOLDER)
        </span>
        <button
          onClick={onClose}
          className="text-stone-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeWorkspace ? (
        <div className="flex-1 flex flex-col p-2 overflow-y-auto">
          <div className="mb-2 px-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Cari file..."
                className="w-full bg-[#252428] border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#FF5E38]"
              />
            </div>
          </div>

          <div className="flex-1">
            <FileTree
              files={workspaceFiles}
              workspaceName={activeWorkspace?.name || "Workspace"}
              onFileClick={(path, name, content) => onOpenFileTab(path, name, content)}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <FolderOpen className="w-10 h-10 text-stone-600 mb-2" />
          <p className="text-xs text-stone-400 mb-3">Belum ada folder workspace yang dibuka</p>
          <button
            onClick={onOpenFolderModal}
            className="w-full py-2 bg-[#FF5E38] hover:bg-[#e04e2a] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Buka Folder Workspace
          </button>
        </div>
      )}
    </aside>
  );
}
