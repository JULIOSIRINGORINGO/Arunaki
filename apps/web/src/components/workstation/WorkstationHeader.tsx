import { FolderOpen, Plus, Sparkles, Bot, SlidersHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";

interface Workspace {
  id: string;
  name: string;
  rootPath: string | null;
}

interface WorkstationHeaderProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  activeWorkspace: Workspace | null;
  onOpenFolderModal: () => void;
  isCanvasOpen: boolean;
  onTriggerCanvas: () => void;
}

export function WorkstationHeader({
  onToggleLeft,
  onToggleRight,
  activeWorkspace,
  onOpenFolderModal,
  isCanvasOpen,
  onTriggerCanvas,
}: WorkstationHeaderProps) {
  return (
    <header className="h-11 bg-[#171717] text-[#FFFFFF] px-4 flex items-center justify-between shrink-0 border-b border-[#2D2D2D]">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLeft}
          className="p-1.5 rounded-md hover:bg-[#262626] text-[#A3A3A3] hover:text-[#FFFFFF] transition-colors cursor-pointer"
          title="Toggle File Explorer [=]"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        <span className="font-semibold text-xs tracking-wider text-[#A3A3A3] uppercase">
          WORKSTATION CONTROLS
        </span>

        {activeWorkspace ? (
          <button
            onClick={onOpenFolderModal}
            className="flex items-center gap-2 px-3 py-1 bg-[#262626] hover:bg-[#333333] text-[#FFFFFF] rounded-md text-xs font-medium border border-[#2D2D2D] transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#A3A3A3]" />
            <span className="truncate max-w-[200px]">{activeWorkspace.name}</span>
          </button>
        ) : (
          <button
            onClick={onOpenFolderModal}
            className="flex items-center gap-2 px-3 py-1 bg-[#262626] hover:bg-[#333333] text-[#FFFFFF] rounded-md text-xs font-semibold border border-[#404040] shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buka Folder Workspace</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onTriggerCanvas}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border",
            isCanvasOpen
              ? "bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]"
              : "bg-[#262626] text-[#E5E5E5] border-[#2D2D2D] hover:bg-[#333333]"
          )}
          title="Panggil / Buka Canvas Panel"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Canvas</span>
        </button>

        <button
          onClick={onToggleRight}
          className="p-1.5 rounded-md hover:bg-[#262626] text-[#A3A3A3] hover:text-[#FFFFFF] transition-colors cursor-pointer"
          title="Toggle Chat Panel"
        >
          <Bot className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
