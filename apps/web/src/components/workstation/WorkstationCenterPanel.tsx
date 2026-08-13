import { memo } from "react";
import { FileText, X, Sparkles } from "lucide-react";
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
}

function WorkstationCenterPanelComponent({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  canvasData,
}: WorkstationCenterPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <main className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden relative">
      {/* Top Multi-Tab Bar */}
      {tabs.length > 0 && (
        <div className="h-9 bg-[#121212] border-b border-border-strong flex items-center px-2 gap-1 overflow-x-auto shrink-0 select-none">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 text-xs font-medium cursor-pointer transition-colors max-w-[200px] group",
                  isActive
                    ? "bg-[#252526] text-[#FFFFFF] font-semibold"
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
      <div className="flex-1 relative overflow-hidden bg-[#0A0A0A]">
        {activeTab ? (
          activeTab.type === "canvas" ? (
            /* ON-DEMAND CANVAS PANEL */
            <div className="h-full w-full flex flex-col text-white">
              <CanvasPanel
                isOpen={true}
                onClose={() => onCloseTab("canvas-active")}
                canvasData={canvasData}
              />
            </div>
          ) : (
            /* IDE FILE READER / DOCUMENT VIEWER */
            <div className="h-full w-full flex flex-col bg-transparent text-white">
              <div className="flex-1 overflow-auto bg-transparent p-4 font-mono text-xs text-[#E5E5E5] leading-relaxed whitespace-pre-wrap">
                {activeTab.content}
              </div>
            </div>
          )
        ) : (
          /* CENTER SVG WORDMARK — no text, no buttons, clean */
          <div className="h-full flex items-center justify-center select-none">
            <img
              src="/text-center.svg"
              alt=""
              className="max-w-[70%] max-h-[40%] object-contain opacity-90"
              draggable={false}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export const WorkstationCenterPanel = memo(WorkstationCenterPanelComponent);
