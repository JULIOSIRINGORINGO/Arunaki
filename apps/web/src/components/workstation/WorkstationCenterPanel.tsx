import { memo, useState, useEffect, useCallback } from "react";
import { FileText, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CenterTab {
  id: string;
  type: "file" | "stage";
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
  onUpdateTabContent,
}: WorkstationCenterPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Per-tab local edited content state to allow live editing
  const [editedContents, setEditedContents] = useState<Record<string, string>>({});
  // Track previous content per tab to compute live diffs when AI updates files
  const [previousContents, setPreviousContents] = useState<Record<string, string>>({});
  // State to hold active diff highlighting per tab
  const [activeDiffs, setActiveDiffs] = useState<Record<string, {
    diffLines: DiffLine[];
    addedCount: number;
    deletedCount: number;
  } | null>>({});

  // Sync tab content when parent updates tab.content
  useEffect(() => {
    if (!activeTab?.id) return;
    const incomingContent = activeTab.content ?? "";
    const existingContent = editedContents[activeTab.id];

    if (existingContent === undefined) {
      setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
      setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
    } else if (incomingContent !== existingContent && incomingContent !== previousContents[activeTab.id]) {
      // Content was updated by AI stream or reload — compute live diff highlight!
      const prevText = previousContents[activeTab.id] ?? existingContent;
      const diffLines = computeLineDiff(prevText, incomingContent);
      const added = diffLines.filter((l) => l.type === "added").length;
      const deleted = diffLines.filter((l) => l.type === "deleted").length;

      if (added > 0 || deleted > 0) {
        setActiveDiffs((prev) => ({
          ...prev,
          [activeTab.id]: {
            diffLines,
            addedCount: added,
            deletedCount: deleted,
          },
        }));

        // Automatically settle and clear diff highlight after 3.5 seconds
        const timer = setTimeout(() => {
          setActiveDiffs((prev) => ({ ...prev, [activeTab.id]: null }));
        }, 3500);

        // Update current and previous contents
        setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
        setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));

        return () => clearTimeout(timer);
      } else {
        setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
        setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
      }
    }
  }, [activeTab?.id, activeTab?.content]);

  const currentContent = activeTab ? (editedContents[activeTab.id] ?? activeTab.content ?? "") : "";
  const activeDiff = activeTab ? activeDiffs[activeTab.id] : null;
  const isDiffActive = !!activeDiff;

  const handleTextChange = useCallback((newText: string) => {
    if (!activeTab?.id) return;
    setEditedContents((prev) => ({ ...prev, [activeTab.id]: newText }));
    if (onUpdateTabContent) {
      onUpdateTabContent(activeTab.id, newText);
    }
  }, [activeTab?.id, onUpdateTabContent]);

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A] overflow-hidden select-none border-r border-[#1F1F1F]">
      {/* Top Document Tabs Bar */}
      {tabs.length > 0 && (
        <div className="h-10 bg-[#121212] border-b border-[#262626] flex items-center px-2 gap-1 overflow-x-auto select-none no-scrollbar shrink-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono cursor-pointer transition-all duration-150 border select-none shrink-0",
                  isActive
                    ? "bg-[#1E1E1E] text-white border-[#333333] shadow-sm"
                    : "bg-transparent text-[#71717A] border-transparent hover:bg-[#1A1A1A] hover:text-[#D4D4D8]"
                )}
              >
                <FileText className={cn("w-3.5 h-3.5", isActive ? "text-[#E4E4E7]" : "text-[#71717A]")} />
                <span className="truncate max-w-[140px]">{tab.title}</span>
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
          isDiffActive && activeDiff ? (
            /* CURSOR / ANTIGRAVITY LIVE DIFF VIEW */
            <div className="h-full w-full flex flex-col bg-[#0A0A0A] font-mono text-xs overflow-hidden select-text">
              <div className="h-7 bg-[#121212] border-b border-[#262626] px-3 flex items-center justify-between text-xs select-none shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
                  <span className="font-mono text-[#A1A1AA] text-[11px]">AI Live Diff</span>
                  <span className="text-[#71717A] text-[11px] font-mono">
                    +{activeDiff.addedCount} / -{activeDiff.deletedCount}
                  </span>
                </div>
                <span className="text-[#52525B] text-[10px] italic">Auto-settling...</span>
              </div>

              <div className="flex-1 overflow-auto p-2 bg-[#0A0A0A] font-mono text-xs leading-relaxed">
                {activeDiff.diffLines.map((line, idx) => {
                  if (line.type === "added") {
                    return (
                      <div key={idx} className="flex items-start bg-[#141C16] border-l-2 border-[#22C55E]/60 text-[#E4E4E7] px-2 py-0.5 whitespace-pre font-mono">
                        <span className="w-10 text-[#52525B] text-right pr-3 select-none text-[10px] shrink-0">{line.newLineNumber}</span>
                        <span className="text-[#4ADE80] font-bold mr-2 select-none shrink-0">+</span>
                        <span className="break-all">{line.content}</span>
                      </div>
                    );
                  }
                  if (line.type === "deleted") {
                    return (
                      <div key={idx} className="flex items-start bg-[#1C1617] border-l-2 border-[#EF4444]/60 text-[#71717A] px-2 py-0.5 whitespace-pre font-mono">
                        <span className="w-10 text-[#52525B] text-right pr-3 select-none text-[10px] shrink-0">{line.oldLineNumber}</span>
                        <span className="text-[#F87171] font-bold mr-2 select-none shrink-0">-</span>
                        <span className="line-through break-all">{line.content}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-start text-[#D4D4D8] px-2 py-0.5 whitespace-pre font-mono hover:bg-[#121212]">
                      <span className="w-10 text-[#52525B] text-right pr-3 select-none text-[10px] shrink-0">{line.newLineNumber || line.oldLineNumber}</span>
                      <span className="w-4 select-none shrink-0" />
                      <span className="break-all">{line.content}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STANDARD EDITABLE FILE / DOCUMENT VIEWER */
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
