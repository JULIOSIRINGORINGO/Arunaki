import { FolderOpen, Plus, Sparkles, Bot, SlidersHorizontal } from "lucide-react";
import { ArunakiLogo } from "../common/ArunakiLogo";
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
    <header className="h-14 bg-[#1A191B] text-[#F4EFE6] px-4 flex items-center justify-between shrink-0 shadow-md border-b border-stone-800">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLeft}
          className="p-1.5 rounded-lg hover:bg-stone-800 text-[#C4B5FD] transition-colors cursor-pointer"
          title="Toggle File Explorer [=]"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>

        <span className="font-semibold text-sm tracking-wide text-[#F4EFE6]">
          ARUNAKI WORKSTATION
        </span>

        {activeWorkspace ? (
          <button
            onClick={onOpenFolderModal}
            className="flex items-center gap-2 px-3 py-1 bg-[#252428] hover:bg-[#2f2e33] text-[#FF5E38] rounded-full text-xs font-medium border border-stone-700/60 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[200px]">{activeWorkspace.name}</span>
          </button>
        ) : (
          <button
            onClick={onOpenFolderModal}
            className="flex items-center gap-2 px-3 py-1 bg-[#FF5E38] hover:bg-[#e04e2a] text-white rounded-full text-xs font-semibold shadow-sm transition-colors cursor-pointer"
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
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
            isCanvasOpen
              ? "bg-[#C4B5FD] text-[#1A191B] border-[#C4B5FD]"
              : "bg-[#252428] text-[#C4B5FD] border-stone-700 hover:border-[#C4B5FD]"
          )}
          title="Panggil / Buka Canvas Panel"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>🎨 Canvas</span>
        </button>

        <button
          onClick={onToggleRight}
          className="p-1.5 rounded-lg hover:bg-stone-800 text-[#C4B5FD] transition-colors cursor-pointer"
          title="Toggle Chat Panel"
        >
          <Bot className="w-5 h-5" />
        </button>

        <div className="w-8 h-8 rounded-full bg-[#252428] flex items-center justify-center border border-stone-700">
          <ArunakiLogo className="w-5 h-5" fill="#FF5E38" />
        </div>
      </div>
    </header>
  );
}
