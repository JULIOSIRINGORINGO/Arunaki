import { memo, useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Save,
  ChevronRight,
  GitBranch,
  AlertTriangle,
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
  createdAt?: string;
  timeStr?: string;
}

export interface WorkstationCenterPanelProps {
  tabs: CenterTab[];
  activeTabId: string | null;
  activeFolder?: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onUpdateTabContent?: (tabId: string, newContent: string) => void;
  onSaveTabContent?: (tabId: string, content: string) => Promise<void> | void;
}

export interface DiffLine {
  type: "unchanged" | "added" | "deleted";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

/**
 * Line-by-line diff algorithm (LCS-based) for VSCode-style gutter change indicators
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
  activeFolder,
  onSelectTab,
  onCloseTab,
  onUpdateTabContent,
  onSaveTabContent,
}: WorkstationCenterPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Per-tab local edited content state to allow live editing
  const [editedContents, setEditedContents] = useState<Record<string, string>>({});
  // Track previous content per tab to compute diffs when AI updates files
  const [previousContents, setPreviousContents] = useState<Record<string, string>>({});
  // Track unsaved status per tab
  const [unsavedTabs, setUnsavedTabs] = useState<Record<string, boolean>>({});
  // State to hold active diff highlighting per tab
  const [activeDiffs, setActiveDiffs] = useState<Record<string, {
    diffLines: DiffLine[];
    addedCount: number;
    deletedCount: number;
  } | null>>({});

  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

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

          // Automatically clear highlights after 10 seconds, or user can dismiss manually
          const timer = setTimeout(() => {
            setActiveDiffs((prev) => ({ ...prev, [activeTab.id]: null }));
          }, 10000);

          setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
          setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
          setUnsavedTabs((prev) => ({ ...prev, [activeTab.id]: false }));

          return () => clearTimeout(timer);
        }
      }

      setEditedContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
      setPreviousContents((prev) => ({ ...prev, [activeTab.id]: incomingContent }));
    }
  }, [activeTab?.id, activeTab?.content, activeTab?.type]);

  const currentContent = activeTab ? (editedContents[activeTab.id] ?? activeTab.content ?? "") : "";
  const activeDiff = activeTab ? activeDiffs[activeTab.id] : null;
  const isUnsaved = activeTab ? !!unsavedTabs[activeTab.id] : false;

  const updateCursorPos = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart || 0;
    const val = textareaRef.current.value || "";
    const linesUpToPos = val.substring(0, pos).split("\n");
    const line = linesUpToPos.length;
    const col = linesUpToPos[linesUpToPos.length - 1].length + 1;
    setCursorPos({ line, col });
  };

  const handleTextChange = useCallback((newText: string) => {
    if (!activeTab?.id) return;
    setEditedContents((prev) => ({ ...prev, [activeTab.id]: newText }));
    setUnsavedTabs((prev) => ({ ...prev, [activeTab.id]: true }));
    if (onUpdateTabContent) {
      onUpdateTabContent(activeTab.id, newText);
    }
  }, [activeTab?.id, onUpdateTabContent]);

  const handleSave = useCallback(async () => {
    if (!activeTab?.id) return;
    if (onSaveTabContent) {
      await onSaveTabContent(activeTab.id, currentContent);
    }
    setUnsavedTabs((prev) => ({ ...prev, [activeTab.id]: false }));
    setPreviousContents((prev) => ({ ...prev, [activeTab.id]: currentContent }));
  }, [activeTab?.id, currentContent, onSaveTabContent]);

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const nextVal = val.substring(0, start) + "    " + val.substring(end);
      handleTextChange(nextVal);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 4;
        updateCursorPos();
      });
    }
  };

  const handleCopyContent = () => {
    if (!currentContent) return;
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!currentContent) return;
    const element = document.createElement("a");
    const file = new Blob([currentContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${activeTab?.title || "document"}-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(element.href), 1000);
  };

  // Build line gutter metadata
  const lines = currentContent.split("\n");
  const addedLineNums = new Set<number>();
  if (activeDiff?.diffLines) {
    for (const dl of activeDiff.diffLines) {
      if (dl.type === "added" && dl.newLineNumber) {
        addedLineNums.add(dl.newLineNumber);
      }
    }
  }

  // Detect language mode for VSCode status bar
  const langMode = activeTab
    ? activeTab.title.endsWith(".txt")
      ? "Plain Text"
      : activeTab.title.endsWith(".md")
      ? "Markdown"
      : activeTab.title.endsWith(".json")
      ? "JSON"
      : activeTab.title.endsWith(".csv")
      ? "CSV"
      : activeTab.title.endsWith(".xlsx") || activeTab.title.endsWith(".xls")
      ? "Excel"
      : activeTab.title.split(".").pop()?.toUpperCase() || "Plain Text"
    : "Plain Text";

  const folderName = activeFolder
    ? activeFolder.split(/[\\/]/).filter(Boolean).pop() || "workspace"
    : "workspace";

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] overflow-hidden select-none border-r border-[#252526] transition-colors duration-150">
      {/* 1. VSCODE TOP TABS BAR */}
      {tabs.length > 0 && (
        <div className="h-[35px] bg-[#252526] border-b border-[#1e1e1e] flex items-center justify-between px-0 gap-0 select-none shrink-0 overflow-hidden">
          {/* Left: VSCode Rectangular Flush Tabs */}
          <div className="flex items-center h-full overflow-x-auto no-scrollbar min-w-0">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const hasUnsavedChanges = !!unsavedTabs[tab.id];
              return (
                <div
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                    }
                  }}
                  className={cn(
                    "group h-full flex items-center gap-2 px-3 text-xs font-sans cursor-pointer transition-colors border-r border-[#1e1e1e] select-none shrink-0 relative",
                    isActive
                      ? "bg-[#1e1e1e] text-[#ffffff] border-t-2 border-t-[#ffffff]"
                      : "bg-[#2d2d2d] text-[#969696] hover:bg-[#2b2b2b] hover:text-[#cccccc] border-t-2 border-t-transparent"
                  )}
                >
                  {getFileIcon(tab.title)}
                  <span className="truncate max-w-[150px] text-[12px] font-normal">{tab.title}</span>
                  {hasUnsavedChanges ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      className="w-2 h-2 rounded-full bg-white group-hover:hidden transition-all"
                      title="Unsaved changes"
                    />
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className={cn(
                      "p-0.5 rounded hover:bg-[#333333] hover:text-white transition-colors cursor-pointer",
                      hasUnsavedChanges ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"
                    )}
                    title="Close (Middle-click)"
                  >
                    <X className="w-3 h-3 text-[#969696] hover:text-white" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right: VSCode Action Icons */}
          {activeTab && (
            <div className="flex items-center gap-1.5 shrink-0 px-2">
              {activeDiff && (
                <span className="text-[11px] text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 rounded border border-[#38bdf8]/20 flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse" />
                  <span>+{activeDiff.addedCount} / -{activeDiff.deletedCount}</span>
                  <button
                    onClick={() => setActiveDiffs((prev) => ({ ...prev, [activeTab.id]: null }))}
                    className="ml-0.5 text-[#38bdf8] hover:text-white cursor-pointer"
                    title="Dismiss highlight"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}

              {isUnsaved && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#ffffff] hover:bg-[#e5e5e5] text-[#000000] font-semibold font-sans text-[11px] transition-colors cursor-pointer shadow-xs"
                  title="Save Changes (Ctrl+S)"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </button>
              )}

              <button
                onClick={handleCopyContent}
                className="p-1.5 rounded text-[#969696] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
                title="Copy Content"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {activeTab.type === "canvas" && (
                <button
                  onClick={handleDownloadTxt}
                  className="p-1.5 rounded text-[#969696] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. VSCODE BREADCRUMBS BAR */}
      {activeTab && (
        <div className="h-[22px] bg-[#1e1e1e] border-b border-[#252526] px-4 flex items-center gap-1.5 text-[11px] text-[#969696] select-none shrink-0 font-sans">
          <span>{folderName}</span>
          <ChevronRight className="w-3 h-3 text-[#6e7681]" />
          <span className="text-[#cccccc] font-medium">{activeTab.title}</span>
        </div>
      )}

      {/* 3. DYNAMIC CONTENT BODY (VSCODE CANVAS) */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#1e1e1e]">
        {activeTab ? (
          activeTab.type === "canvas" ? (
            /* ARUNAKI DELIVERABLE CANVAS */
            <div className="h-full w-full flex flex-col bg-[#1e1e1e] overflow-hidden">
              <div className="flex-1 overflow-auto px-6 py-4 bg-[#1e1e1e]">
                <pre className="font-mono text-[13px] text-[#d4d4d4] leading-[20px] whitespace-pre-wrap select-text selection:bg-[#264f78] selection:text-[#ffffff]">
                  {currentContent}
                </pre>
              </div>
            </div>
          ) : (
            /* VSCODE-STYLE LIVE EDITABLE FILE EDITOR WITH GUTTER */
            <div className="h-full w-full flex flex-col bg-[#1e1e1e] overflow-hidden">
              <div className="flex-1 flex overflow-hidden bg-[#1e1e1e] relative font-mono text-[13px]">
                {/* Gutter with VSCode-style line numbers & change indicator bars */}
                <div
                  ref={gutterRef}
                  className="w-[50px] shrink-0 select-none bg-[#1e1e1e] border-r border-[#252526]/50 overflow-hidden text-right py-2 pr-3.5 font-mono text-[12px] text-[#858585]"
                >
                  {lines.map((_, i) => {
                    const lineNum = i + 1;
                    const isAdded = addedLineNums.has(lineNum);
                    const isCurrentLine = cursorPos.line === lineNum;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "h-[20px] leading-[20px] relative transition-colors",
                          isCurrentLine && "text-[#c6c6c6] font-medium"
                        )}
                      >
                        {isAdded && (
                          <span
                            className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2ea043]"
                            title="Line added / updated by AI"
                          />
                        )}
                        <span>{lineNum}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Editable live document area (VSCode Typography & Caret) */}
                <textarea
                  ref={textareaRef}
                  value={currentContent}
                  onChange={(e) => {
                    handleTextChange(e.target.value);
                    updateCursorPos();
                  }}
                  onClick={updateCursorPos}
                  onKeyUp={updateCursorPos}
                  onSelect={updateCursorPos}
                  onScroll={handleScroll}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  placeholder="Empty document..."
                  className="flex-1 h-full py-2 px-3 bg-transparent font-mono text-[13px] text-[#d4d4d4] leading-[20px] resize-none focus:outline-none select-text cursor-text whitespace-pre border-none tab-4 overflow-auto selection:bg-[#264f78] selection:text-[#ffffff] caret-[#0078d4]"
                  style={{
                    fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
                  }}
                />
              </div>
            </div>
          )
        ) : (
          /* CENTER ARUNAKI AGENT WATERMARK (Original) */
          <div className="h-full w-full flex flex-col items-center justify-center select-none p-8 animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-6">
              <ArunakiLogo className="w-16 h-16 text-[var(--text-primary)] opacity-95" />
              <span className="font-sans text-2xl md:text-3xl font-light tracking-wide text-[var(--text-primary)] opacity-95 select-none">
                Arunaki Agent
              </span>
            </div>

            <div className="mt-20 text-sm md:text-base text-[var(--text-dim)] font-sans tracking-wide select-none opacity-90">
              Work with Agent
            </div>
          </div>
        )}
      </div>

      {/* 4. MONOCHROME BOTTOM STATUS BAR (WHITE BACKGROUND, BLACK CONTENT) */}
      {activeTab && (
        <footer className="h-[22px] bg-white text-black border-t border-neutral-300 px-3 flex items-center justify-between text-[11px] font-sans select-none shrink-0 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer text-black">
              <GitBranch className="w-3 h-3 text-black" />
              <span>main*</span>
            </span>
            <span className="flex items-center gap-1 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer text-black">
              <AlertTriangle className="w-3 h-3 text-black" />
              <span>0</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-black">
            <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">
              Spaces: 4
            </span>
            <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">
              UTF-8
            </span>
            <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer">
              CRLF
            </span>
            <span className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer font-bold">
              {langMode}
            </span>
          </div>
        </footer>
      )}
    </main>
  );
}

export const WorkstationCenterPanel = memo(WorkstationCenterPanelComponent);
