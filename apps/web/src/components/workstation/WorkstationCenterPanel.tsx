import { memo, useState, useEffect, useCallback } from "react";
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
  onUpdateTabContent?: (tabId: string, newContent: string) => void;
}

function WorkstationCenterPanelComponent({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  canvasData,
  onUpdateTabContent,
}: WorkstationCenterPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Per-tab local edited content state to allow live editing
  const [editedContents, setEditedContents] = useState<Record<string, string>>({});

  // Sync activeTab initial content into state
  useEffect(() => {
    if (activeTab && activeTab.type === "file" && activeTab.content !== undefined) {
      setEditedContents((prev) => {
        if (prev[activeTab.id] === undefined) {
          return { ...prev, [activeTab.id]: activeTab.content || "" };
        }
        return prev;
      });
    }
  }, [activeTab]);

  const currentContent = activeTab && activeTab.type === "file"
    ? (editedContents[activeTab.id] !== undefined ? editedContents[activeTab.id] : (activeTab.content || ""))
    : "";

  const handleTextChange = (val: string) => {
    if (!activeTab) return;
    setEditedContents((prev) => ({ ...prev, [activeTab.id]: val }));
  };

  const handleSaveFile = useCallback(async () => {
    if (!activeTab || activeTab.type !== "file" || !activeTab.path) return;
    const tabId = activeTab.id;
    const filePath = activeTab.path;
    const contentToSave = editedContents[tabId] !== undefined ? editedContents[tabId] : (activeTab.content || "");

    try {
      // 1. Electron IPC save
      if ((window as any).arunakiDesktop?.writeFile) {
        const res = await (window as any).arunakiDesktop.writeFile(filePath, contentToSave);
        if (res?.error) {
          throw new Error(res.error);
        }
      } else {
        // 2. Web API save fallback
        await fetch("/api/v1/workspace/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content: contentToSave }),
        }).catch(() => {});
      }

      // Update parent tab content
      if (onUpdateTabContent) {
        onUpdateTabContent(tabId, contentToSave);
      } else {
        activeTab.content = contentToSave;
      }
    } catch (err) {
      console.error("[WorkstationCenterPanel] Save failed:", err);
    }
  }, [activeTab, editedContents, onUpdateTabContent]);

  // Keyboard shortcut Ctrl+S / Cmd+S for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveFile]);

  return (
    <main className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden relative select-text">
      {/* Top Multi-Tab Bar */}
      {tabs.length > 0 && (
        <div className="h-9 bg-[#121212] border-b border-[#262626] flex items-center px-2 gap-1 overflow-x-auto shrink-0 select-none">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabIsModified = editedContents[tab.id] !== undefined && editedContents[tab.id] !== (tab.content || "");
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }
                }}
                title="Klik tengah (scroll wheel) untuk menutup tab"
                className={cn(
                  "flex items-center gap-2 px-3 py-1 text-xs font-medium cursor-pointer transition-colors max-w-[200px] group border-r border-[#1E1E1E]",
                  isActive
                    ? "bg-[#252526] text-[#FFFFFF] font-semibold border-t-2 border-t-white"
                    : "text-[#A3A3A3] hover:bg-[#1E1E1E] hover:text-[#FFFFFF]"
                )}
              >
                {tab.type === "canvas" ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#E5E5E5] shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0" />
                )}
                <span className="truncate">{tab.title}</span>
                {tabIsModified && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Belum disimpan" />
                )}
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
            <div className="h-full w-full flex flex-col text-white select-none">
              <CanvasPanel
                isOpen={true}
                onClose={() => onCloseTab("canvas-active")}
                canvasData={canvasData}
              />
            </div>
          ) : (
            /* IDE LIVE INTERACTIVE EDITABLE DOCUMENT EDITOR */
            <div className="h-full w-full flex flex-col bg-[#0A0A0A]">
              <textarea
                value={currentContent}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="File kosong..."
                spellCheck={false}
                className="w-full h-full p-4 bg-transparent font-mono text-xs text-[#E5E5E5] leading-relaxed resize-none focus:outline-none select-text cursor-text selection:bg-[#333333] selection:text-white"
              />
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
