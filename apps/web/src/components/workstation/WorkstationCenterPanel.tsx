import { Sparkles, FileText, FileSpreadsheet, X, FolderOpen } from "lucide-react";
import { ArunakiLogo } from "../common/ArunakiLogo";
import { CanvasPanel, CanvasData } from "../chat/CanvasPanel";
import { cn } from "../../lib/utils";

export interface CenterTab {
  id: string;
  type: "file" | "canvas" | "stage";
  title: string;
  path?: string;
  fileType?: string;
  content?: string;
}

interface WorkstationCenterPanelProps {
  tabs: CenterTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  canvasData: CanvasData | null;
  onOpenFolderModal: () => void;
  onTriggerCanvas: () => void;
}

export function WorkstationCenterPanel({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  canvasData,
  onOpenFolderModal,
  onTriggerCanvas,
}: WorkstationCenterPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <main className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden relative">
      {/* Top Multi-Tab Bar */}
      {tabs.length > 0 && (
        <div className="h-9 bg-[#121212] border-b border-[#2D2D2D] flex items-center px-2 gap-1 overflow-x-auto shrink-0 select-none">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-t-md text-xs font-medium cursor-pointer transition-colors max-w-[200px] group border-t border-x border-transparent",
                  isActive
                    ? "bg-[#171717] text-[#FFFFFF] border-[#2D2D2D] font-semibold"
                    : "text-[#A3A3A3] hover:bg-[#1E1E1E] hover:text-[#FFFFFF]"
                )}
              >
                {tab.type === "canvas" ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#E5E5E5] shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0" />
                )}
                <span className="truncate">{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Content Body */}
      <div className="flex-1 p-4 overflow-auto bg-[#0A0A0A]">
        {activeTab ? (
          activeTab.type === "canvas" ? (
            /* ON-DEMAND CANVAS PANEL */
            <div className="h-full w-full bg-[#171717] rounded-xl p-4 border border-[#2D2D2D] flex flex-col text-white">
              <CanvasPanel
                isOpen={true}
                onClose={() => onCloseTab("canvas-active")}
                canvasData={canvasData}
              />
            </div>
          ) : (
            /* IDE FILE READER / DOCUMENT VIEWER */
            <div className="h-full w-full bg-[#171717] rounded-xl p-5 border border-[#2D2D2D] flex flex-col text-white">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2D2D2D]">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#E5E5E5]" />
                  <h2 className="font-bold text-xs text-[#FFFFFF]">{activeTab.title}</h2>
                  <span className="text-[10px] text-[#A3A3A3] bg-[#262626] px-2 py-0.5 rounded font-mono">
                    {activeTab.fileType?.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-[#A3A3A3] truncate max-w-md">{activeTab.path}</span>
              </div>

              <div className="flex-1 overflow-auto bg-[#121212] p-4 rounded-lg border border-[#2D2D2D] font-mono text-xs text-[#E5E5E5] leading-relaxed whitespace-pre-wrap">
                {activeTab.content}
              </div>
            </div>
          )
        ) : (
          /* WELCOME / GETTING STARTED VIEW */
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-[#171717] border border-[#2D2D2D] flex items-center justify-center mb-4 shadow-none">
              <ArunakiLogo className="w-9 h-9" fill="#FFFFFF" />
            </div>
            <h1 className="text-lg font-bold text-white mb-2 tracking-tight">
              Arunaki IDE Document Workstation
            </h1>
            <p className="text-xs text-[#A3A3A3] max-w-md mb-6 leading-relaxed">
              Lingkungan kerja terpadu untuk membaca, menghitung, dan merekap dokumen bisnis secara otomatis.
            </p>

            <div className="grid grid-cols-2 gap-4 max-w-lg w-full text-left">
              <div
                onClick={onOpenFolderModal}
                className="p-4 bg-[#171717] rounded-xl border border-[#2D2D2D] hover:border-[#525252] transition-all cursor-pointer group"
              >
                <FolderOpen className="w-5 h-5 text-[#E5E5E5] mb-2 group-hover:scale-105 transition-transform" />
                <h3 className="text-xs font-bold text-white">Buka Folder Workspace</h3>
                <p className="text-[11px] text-[#A3A3A3]">Hubungkan folder lokal berisi file kantor</p>
              </div>

              <div
                onClick={onTriggerCanvas}
                className="p-4 bg-[#171717] rounded-xl border border-[#2D2D2D] hover:border-[#525252] transition-all cursor-pointer group"
              >
                <Sparkles className="w-5 h-5 text-[#E5E5E5] mb-2 group-hover:scale-105 transition-transform" />
                <h3 className="text-xs font-bold text-white">Panggil AI Canvas</h3>
                <p className="text-[11px] text-[#A3A3A3]">Buka panel draf terstruktur & kalkulasi</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
