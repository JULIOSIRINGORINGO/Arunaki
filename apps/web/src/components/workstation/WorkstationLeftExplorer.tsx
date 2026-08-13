import { Folder, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  onOpenFolderModal?: () => void;
}

export function WorkstationLeftExplorer({
  collapsed,
  onClose,
  activeWorkspace,
  workspaceFiles,
  onOpenFileTab,
}: WorkstationLeftExplorerProps) {
  /* Thin Icon Strip when Collapsed (Clicking re-opens the panel) */
  if (collapsed) {
    return (
      <aside className="w-10 bg-[#121212] border-r border-[#383838] flex flex-col items-center py-2 shrink-0 select-none">
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1.5 rounded-md hover:bg-[#1E1E1E] transition-colors cursor-pointer"
          title="Buka Panel Eksplore"
        >
          <PanelLeftOpen className="w-4 h-4 text-[#FFFFFF]" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-4 text-[#A3A3A3]">
          <Folder className="w-4 h-4 opacity-40" />
        </div>
      </aside>
    );
  }

  /* Full Expanded Panel */
  return (
    <aside className="w-64 bg-[#121212] text-[#FFFFFF] border-r border-[#383838] flex flex-col shrink-0">
      {/* 1. Header Panel: Title Case ("Eksplore") & Tombol Toggle Collapse */}
      <div className="px-3 py-2.5 border-b border-[#383838] flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-[#E5E5E5] flex items-center gap-2">
          <Folder className="w-3.5 h-3.5 text-[#A3A3A3]" />
          Eksplore
        </span>
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1 rounded-md hover:bg-[#1E1E1E] transition-colors cursor-pointer"
          title="Tutup Panel Eksplore"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* 2. File Explorer Tree / Area Empty State Minimalis (Rata & Rapi Tanpa Searchbar) */}
      {activeWorkspace ? (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <FileTree
            files={workspaceFiles}
            workspaceName={activeWorkspace?.name || "Workspace"}
            onFileClick={(path, name, content) => onOpenFileTab(path, name, content)}
          />
        </div>
      ) : (
        /* 3. Placeholder Kosong Minimalis (No Button, Soft Opacity Icon) */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Folder className="w-8 h-8 text-[#A3A3A3] opacity-35 mb-2 stroke-[1.5]" />
          <p className="text-xs text-[#737373] font-normal">Belum ada folder terbuka</p>
        </div>
      )}
    </aside>
  );
}
