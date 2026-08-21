import { memo, useState, useEffect, useCallback } from "react";
import {
  X,
  Copy,
  CopyCheck,
  Download,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getFileIcon } from "../workspace/tree-utils";
import { ArunakiLogo } from "../common/ArunakiLogo";

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

  const [copiedCanvas, setCopiedCanvas] = useState(false);

  // Sync tab content when parent updates tab.content
  useEffect(() => {
    if (!activeTab?.id) return;
    const incomingContent = activeTab.content ?? "";
    const existingContent = editedContents[activeTab.id];

    if (existingContent === undefined) {
      setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
      setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
    } else if (incomingContent !== existingContent && incomingContent !== previousContents[activeTab.id]) {
      if (activeTab.type === "file") {
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

          const timer = setTimeout(() => {
            setActiveDiffs((prev) => ({ ...prev, [activeTab.id]: null }));
          }, 3500);

          setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
          setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));

          return () => clearTimeout(timer);
        }
      }

      setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
      setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
    }
  }, [activeTab?.id, activeTab?.content, activeTab?.type]);

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

  const handleCopyCanvas = () => {
    if (!currentContent) return;
    navigator.clipboard.writeText(currentContent);
    setCopiedCanvas(true);
    setTimeout(() => setCopiedCanvas(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!currentContent) return;
    const element = document.createElement("a");
    const file = new Blob([currentContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `canvas-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(element.href), 1000);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app)] overflow-hidden select-none border-r border-[var(--border-color)] transition-colors duration-150">
      {/* Top Tabs Bar (Antigravity Style) */}
      {tabs.length > 0 && (
        <div className="h-9 bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center px-2 gap-1 overflow-x-auto select-none no-scrollbar shrink-0 transition-colors duration-150">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-1 rounded text-xs font-sans cursor-pointer transition-all duration-150 border select-none shrink-0",
                  isActive
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-strong)]"
                    : "bg-transparent text-[var(--text-muted)] border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                {getFileIcon(tab.title)}
                <span className="truncate max-w-[150px] font-medium">{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded transition-opacity cursor-pointer"
                  title="Close Tab"
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Content Body */}
      <div className="flex-1 relative overflow-hidden bg-[var(--bg-app)] flex flex-col transition-colors duration-150">
        {activeTab ? (
          activeTab.type === "canvas" ? (
            /* ANTIGRAVITY-STYLE CANVAS ARTIFACT VIEW (PURE MONOSPACE PLAINTEXT) */
            <div className="h-full w-full flex flex-col bg-[var(--bg-app)] overflow-hidden select-text">
              {/* Clean Sub-Header Bar */}
              <div className="h-9 bg-[var(--bg-panel)] border-b border-[var(--border-color)] px-5 flex items-center justify-between text-xs select-none shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide">
                    {activeTab.title}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    less than a minute ago
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCanvas}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-1.5"
                    title={copiedCanvas ? "Copied!" : "Copy to Clipboard"}
                  >
                    {copiedCanvas ? (
                      <CopyCheck className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Pure Plaintext Body (Preserves exact raw spacing & ready to copy directly) */}
              <div className="flex-1 overflow-auto px-8 py-6 bg-[var(--bg-app)]">
                <div className="max-w-3xl mx-auto">
                  <pre className="font-mono text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap select-text selection:bg-[var(--bg-hover)] selection:text-[var(--text-primary)]">
                    {currentContent}
                  </pre>
                </div>
              </div>
            </div>
          ) : isDiffActive && activeDiff ? (
            /* CURSOR / ANTIGRAVITY LIVE DIFF VIEW */
            <div className="h-full w-full flex flex-col bg-[var(--bg-app)] font-mono text-xs overflow-hidden select-text">
              <div className="h-7 bg-[var(--bg-panel)] border-b border-[var(--border-color)] px-3 flex items-center justify-between text-xs select-none shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
                  <span className="font-mono text-[var(--text-muted)] text-[11px]">AI Live Diff</span>
                  <span className="text-[var(--text-dim)] text-[11px] font-mono">
                    +{activeDiff.addedCount} / -{activeDiff.deletedCount}
                  </span>
                </div>
                <span className="text-[var(--text-dim)] text-[10px] italic">Auto-settling...</span>
              </div>

              <div className="flex-1 overflow-auto p-2 bg-[var(--bg-app)] font-mono text-xs leading-relaxed">
                {activeDiff.diffLines.map((line, idx) => {
                  if (line.type === "added") {
                    return (
                      <div key={idx} className="flex items-start bg-emerald-500/10 border-l-2 border-emerald-500 text-[var(--text-primary)] px-2 py-0.5 whitespace-pre font-mono">
                        <span className="w-10 text-[var(--text-dim)] text-right pr-3 select-none text-[10px] shrink-0">{line.newLineNumber}</span>
                        <span className="text-emerald-500 font-bold mr-2 select-none shrink-0">+</span>
                        <span className="break-all">{line.content}</span>
                      </div>
                    );
                  }
                  if (line.type === "deleted") {
                    return (
                      <div key={idx} className="flex items-start bg-red-500/10 border-l-2 border-red-500 text-[var(--text-muted)] px-2 py-0.5 whitespace-pre font-mono">
                        <span className="w-10 text-[var(--text-dim)] text-right pr-3 select-none text-[10px] shrink-0">{line.oldLineNumber}</span>
                        <span className="text-red-500 font-bold mr-2 select-none shrink-0">-</span>
                        <span className="line-through break-all">{line.content}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-start text-[var(--text-secondary)] px-2 py-0.5 whitespace-pre font-mono hover:bg-[var(--bg-hover)]">
                      <span className="w-10 text-[var(--text-dim)] text-right pr-3 select-none text-[10px] shrink-0">{line.newLineNumber || line.oldLineNumber}</span>
                      <span className="w-4 select-none shrink-0" />
                      <span className="break-all">{line.content}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STANDARD EDITABLE FILE / DOCUMENT VIEWER */
            <div className="h-full w-full flex flex-col bg-[var(--bg-app)]">
              <textarea
                value={currentContent}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Empty document..."
                spellCheck={false}
                className="w-full h-full p-4 bg-transparent font-mono text-xs text-[var(--text-primary)] leading-relaxed resize-none focus:outline-none select-text cursor-text selection:bg-[var(--bg-hover)] selection:text-[var(--text-primary)]"
              />
            </div>
          )
        ) : (
          /* CENTER ARUNAKI AGENTS WATERMARK (Antigravity Style) */
          <div className="h-full w-full flex flex-col items-center justify-center select-none p-6 animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-3.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-300">
              <ArunakiLogo className="w-11 h-11 text-current opacity-80" />
              <span className="font-noto-serif text-[15px] tracking-wide text-current opacity-85">
                Arunaki Agents
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export const WorkstationCenterPanel = memo(WorkstationCenterPanelComponent);
