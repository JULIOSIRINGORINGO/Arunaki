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
    <aside className="w-64 bg-[#121212] text-[#FFFFFF] border-r border-[#2D2D2D] flex flex-col shrink-0">
      <div className="p-3 border-b border-[#2D2D2D] flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-[#A3A3A3] uppercase flex items-center gap-2">
          <Folder className="w-4 h-4 text-[#FFFFFF]" />
          EKSPLORE FOLDER
        </span>
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1 rounded transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeWorkspace ? (
        <div className="flex-1 flex flex-col p-2 overflow-y-auto">
          <div className="mb-2 px-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#737373]" />
              <input
                type="text"
                placeholder="Cari file..."
                className="w-full bg-[#1E1E1E] border border-[#2D2D2D] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
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
          <FolderOpen className="w-10 h-10 text-[#525252] mb-2" />
          <p className="text-xs text-[#A3A3A3] mb-3">Belum ada folder workspace yang dibuka</p>
          <button
            onClick={onOpenFolderModal}
            className="w-full py-2 bg-[#262626] hover:bg-[#333333] border border-[#404040] text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
          >
            Buka Folder Workspace
          </button>
        </div>
      )}
    </aside>
  );
}
