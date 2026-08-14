import { memo, useState, useEffect, useCallback } from "react";
import { FileText, X, Sparkles, Check } from "lucide-react";
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

export interface DiffLine {
  type: "unchanged" | "added" | "deleted";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

/**
 * Line-by-line diff algorithm (LCS-based) for Cursor/Antigravity style live diff highlights
 */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split("\n") : [];
  const newLines = newText ? newText.split("\n") : [];

  const N = oldLines.length;
  const M = newLines.length;

  // LCS Matrix
  const L: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      if (oldLines[i] === newLines[j]) {
        L[i + 1][j + 1] = L[i][j] + 1;
      } else {
        L[i + 1][j + 1] = Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
  }

  let i = N;
  let j = M;
  const result: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: "unchanged",
        oldLineNumber: i,
        newLineNumber: j,
        content: oldLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || L[i][j - 1] >= L[i - 1][j])) {
      result.unshift({
        type: "added",
        newLineNumber: j,
        content: newLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || L[i][j - 1] < L[i - 1][j])) {
      result.unshift({
        type: "deleted",
        oldLineNumber: i,
        content: oldLines[i - 1],
      });
      i--;
    }
  }

  return result;
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
  // Track previous content per tab to compute live diffs when AI updates files
  const [previousContents, setPreviousContents] = useState<Record<string, string>>({});
  // Live diff view state per tab
  const [diffStates, setDiffStates] = useState<
    Record<
      string,
      {
        diffLines: DiffLine[];
        addedCount: number;
        deletedCount: number;
        active: boolean;
      }
    >
  >({});

  // Sync activeTab content into state & detect AI file edits for live diff view
  useEffect(() => {
    if (activeTab && activeTab.type === "file" && activeTab.content !== undefined) {
      const tabId = activeTab.id;
      const newContent = activeTab.content || "";
      const oldContent = previousContents[tabId];

      setEditedContents((prev) => ({
        ...prev,
        [tabId]: newContent,
      }));

      // Trigger Live Diff view if content was updated externally (by AI tool call)
      if (oldContent !== undefined && oldContent !== newContent && oldContent.trim().length > 0) {
        const lines = computeLineDiff(oldContent, newContent);
        const added = lines.filter((l) => l.type === "added").length;
        const deleted = lines.filter((l) => l.type === "deleted").length;

        if (added > 0 || deleted > 0) {
          setDiffStates((prev) => ({
            ...prev,
            [tabId]: {
              diffLines: lines,
              addedCount: added,
              deletedCount: deleted,
              active: true,
            },
          }));
        }
      }

      setPreviousContents((prev) => ({
        ...prev,
        [tabId]: newContent,
      }));
    }
  }, [activeTab?.id, activeTab?.content]);

  const currentContent = activeTab && activeTab.type === "file"
    ? (editedContents[activeTab.id] !== undefined ? editedContents[activeTab.id] : (activeTab.content || ""))
    : "";

  const activeDiff = activeTab ? diffStates[activeTab.id] : null;
  const isDiffActive = !!(activeDiff && activeDiff.active);

  const handleAcceptDiff = (tabId: string) => {
    setDiffStates((prev) => ({
      ...prev,
      [tabId]: { ...prev[tabId], active: false },
    }));
  };

  const handleTextChange = (val: string) => {
    if (!activeTab) return;
    setEditedContents((prev) => ({ ...prev, [activeTab.id]: val }));
    // Typing clears diff highlights
    if (diffStates[activeTab.id]?.active) {
      handleAcceptDiff(activeTab.id);
    }
  };

  const handleSaveFile = useCallback(async () => {
    if (!activeTab || activeTab.type !== "file" || !activeTab.path) return;
    const tabId = activeTab.id;
    const filePath = activeTab.path;
    const contentToSave = editedContents[tabId] !== undefined ? editedContents[tabId] : (activeTab.content || "");

    try {
      if ((window as any).arunakiDesktop?.writeFile) {
        const res = await (window as any).arunakiDesktop.writeFile(filePath, contentToSave);
        if (res?.error) {
          throw new Error(res.error);
        }
      } else {
        await fetch("/api/v1/workspace/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content: contentToSave }),
        }).catch(() => {});
      }

      if (onUpdateTabContent) {
        onUpdateTabContent(tabId, contentToSave);
      } else {
        activeTab.content = contentToSave;
      }
      handleAcceptDiff(tabId);
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
            const tabHasDiff = diffStates[tab.id]?.active;

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
                {tabHasDiff ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Live Diff Update" />
                ) : tabIsModified ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Belum disimpan" />
                ) : null}
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
      <div className="flex-1 relative overflow-hidden bg-[#0A0A0A] flex flex-col">
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
          ) : isDiffActive && activeDiff ? (
            /* CURSOR / ANTIGRAVITY LIVE DIFF INTERACTIVE VIEW */
            <div className="h-full w-full flex flex-col bg-[#0A0A0A] font-mono text-xs overflow-hidden select-text">
              {/* Sleek Diff Header Bar */}
              <div className="h-8 bg-[#161618] border-b border-[#27272A] px-4 flex items-center justify-between text-xs select-none shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-emerald-400 text-xs">AI Live File Diff Applied</span>
                  <span className="text-[#A1A1AA] text-[11px] font-mono">
                    +{activeDiff.addedCount} lines / -{activeDiff.deletedCount} lines
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptDiff(activeTab.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#27272A] hover:bg-[#3F3F46] text-white rounded text-[11px] font-medium transition-colors border border-[#3F3F46]"
                  >
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Terima Perubahan</span>
                  </button>
                </div>
              </div>

              {/* Line Diff Viewer Body */}
              <div className="flex-1 overflow-auto p-2 bg-[#0D0D0E] font-mono text-xs leading-relaxed">
                {activeDiff.diffLines.map((line, idx) => {
                  if (line.type === "added") {
                    return (
                      <div key={idx} className="flex items-start bg-[#122618] border-l-2 border-emerald-500 text-[#86EFAC] px-2 py-0.5 whitespace-pre font-mono">
                        <span className="w-10 text-[#52525B] text-right pr-3 select-none text-[10px] shrink-0">{line.newLineNumber}</span>
                        <span className="text-emerald-500 mr-2 select-none shrink-0">+</span>
                        <span className="break-all">{line.content}</span>
                      </div>
                    );
                  }
                  if (line.type === "deleted") {
                    return (
                      <div key={idx} className="flex items-start bg-[#2E1618] border-l-2 border-red-500 text-[#FCA5A5] opacity-80 px-2 py-0.5 whitespace-pre font-mono">
                        <span className="w-10 text-[#52525B] text-right pr-3 select-none text-[10px] shrink-0">{line.oldLineNumber}</span>
                        <span className="text-red-500 mr-2 select-none shrink-0">-</span>
                        <span className="line-through break-all">{line.content}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-start text-[#D4D4D8] px-2 py-0.5 whitespace-pre font-mono hover:bg-[#18181B]">
                      <span className="w-10 text-[#52525B] text-right pr-3 select-none text-[10px] shrink-0">{line.newLineNumber || line.oldLineNumber}</span>
                      <span className="w-4 select-none shrink-0" />
                      <span className="break-all">{line.content}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STANDARD EDITABLE FILE EDITOR */
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
          /* CENTER SVG WORDMARK */
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
