import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Folder, PanelLeftClose, PanelLeftOpen, RotateCw, ChevronDown, PanelsTopLeft } from "lucide-react";
import FileTree from "../workspace/FileTree";
import { NativeNode } from "../workspace/tree-utils";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

const flattenFileNames = (nodes: NativeNode[]): string[] => {
  const out: string[] = [];
  const walk = (list: NativeNode[]) => {
    for (const n of list) {
      if (n.type === "file") out.push(n.name);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
};

export interface CanvasItem {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  timeStr?: string;
}

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
  width?: number | string;
  onNativeFilesChange?: (names: string[]) => void;
  recentCanvases?: CanvasItem[];
  onOpenCanvasTab?: (item: CanvasItem) => void;
}

type LoadState = "idle" | "loading" | "done" | "error";

function formatCanvasTitle(title: string): string {
  if (!title) return "Document Canvas";
  const clean = title.replace(/^#+\s*/, "").replace(/[`*|_]/g, "").trim();
  if (clean === clean.toUpperCase() && clean.length > 2) {
    return clean
      .toLowerCase()
      .split(" ")
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ");
  }
  return clean;
}

function WorkstationLeftExplorerComponent({
  collapsed,
  onClose,
  activeWorkspace,
  workspaceFiles,
  onOpenFileTab,
  width = 256,
  onNativeFilesChange,
  recentCanvases = [],
  onOpenCanvasTab,
}: WorkstationLeftExplorerProps) {
  const [nativeTree, setNativeTree] = useState<NativeNode[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCanvasSectionOpen, setIsCanvasSectionOpen] = useState(true);
  const lastLoadedPath = useRef<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Core: load native filesystem tree via Electron IPC
  // ─────────────────────────────────────────────────────────────────────────
  const loadNativeTree = useCallback(async (rootPath: string, force = false) => {
    const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;

    if (!desktop?.getFolderTree) {
      console.log("[Explorer] Not running in Electron — no getFolderTree available");
      setLoadState("done");
      return;
    }

    if (!force && lastLoadedPath.current === rootPath) return;

    console.log(`[Explorer] Loading native tree for: ${rootPath}`);
    setLoadState("loading");

    try {
      const result = await desktop.getFolderTree(rootPath);
      if (result?.tree && Array.isArray(result.tree)) {
        setNativeTree(result.tree as NativeNode[]);
        lastLoadedPath.current = rootPath;
        setLoadState("done");
      } else {
        setNativeTree([]);
        setLoadState("error");
      }
    } catch (err: any) {
      console.error("[Explorer] getFolderTree error:", err);
      setNativeTree([]);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspace?.rootPath) {
      setNativeTree([]);
      setLoadState("idle");
      lastLoadedPath.current = null;
      return;
    }
    loadNativeTree(activeWorkspace.rootPath);
  }, [activeWorkspace?.rootPath, loadNativeTree]);

  useEffect(() => {
    onNativeFilesChange?.(flattenFileNames(nativeTree));
  }, [nativeTree, onNativeFilesChange]);

  const handleRefresh = useCallback(async () => {
    if (!activeWorkspace?.rootPath || isRefreshing) return;
    setIsRefreshing(true);
    await loadNativeTree(activeWorkspace.rootPath, true);
    setIsRefreshing(false);
  }, [activeWorkspace?.rootPath, isRefreshing, loadNativeTree]);

  const handleRenamePath = useCallback(
    async (oldPath: string, oldName: string, newName: string) => {
      if (!newName || newName.trim() === oldName) return;
      const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
      if (desktop?.renamePath) {
        const lastSlash = Math.max(oldPath.lastIndexOf("\\"), oldPath.lastIndexOf("/"));
        const parentDir = lastSlash !== -1 ? oldPath.substring(0, lastSlash) : "";
        const separator = oldPath.includes("\\") ? "\\" : "/";
        const newPath = parentDir ? `${parentDir}${separator}${newName.trim()}` : newName.trim();
        try {
          const res = await desktop.renamePath(oldPath, newPath);
          if (res?.success) {
            toast.success(`Renamed to "${newName.trim()}"`);
            handleRefresh();
          } else {
            toast.error(res?.error || "Failed to rename");
          }
        } catch (err: any) {
          toast.error(`Rename failed: ${err.message}`);
        }
      }
    },
    [handleRefresh]
  );

  const handleDeletePath = useCallback(
    async (targetPath: string, targetName: string) => {
      if (!confirm(`Are you sure you want to delete "${targetName}"?`)) return;
      const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
      if (desktop?.deletePath) {
        try {
          const res = await desktop.deletePath(targetPath);
          if (res?.success) {
            toast.success(`Deleted "${targetName}"`);
            handleRefresh();
          } else {
            toast.error(res?.error || "Failed to delete");
          }
        } catch (err: any) {
          toast.error(`Delete failed: ${err.message}`);
        }
      }
    },
    [handleRefresh]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Collapsed strip
  // ─────────────────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="w-10 bg-[var(--bg-panel)] border-r border-[var(--border-color)] flex flex-col items-center py-2 shrink-0 select-none transition-colors duration-150">
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          title="Open Explorer Panel"
        >
          <PanelLeftOpen className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={1.5} />
        </button>
        <div className="mt-4 flex flex-col items-center gap-4 text-[var(--text-muted)]">
          <Folder className="w-4 h-4 opacity-40" strokeWidth={1.5} />
        </div>
      </aside>
    );
  }

  const hasNative = nativeTree.length > 0;
  const apiFiles = workspaceFiles.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    size: f.size,
  }));

  // ─────────────────────────────────────────────────────────────────────────
  // Full expanded panel
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <aside className="bg-[var(--bg-panel)] text-[var(--text-primary)] border-r border-[var(--border-color)] flex flex-col shrink-0 transition-colors duration-150" style={{ width }}>
      {/* Panel Header */}
      <div className="h-9 px-3 box-border border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Folder className="w-3.5 h-3.5 text-amber-500/80 dark:text-amber-400/80" strokeWidth={1.5} />
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          {activeWorkspace?.rootPath && (
            <button
              onClick={handleRefresh}
              className={`text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${isRefreshing ? "animate-spin" : ""}`}
              title="Refresh Explorer"
              disabled={isRefreshing}
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Close Explorer"
          >
            <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* File Explorer Area */}
      {activeWorkspace ? (
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
          {loadState === "loading" ? (
            <div className="flex flex-col gap-1 px-3 py-3 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 rounded bg-[var(--bg-hover)]"
                  style={{ width: `${60 + Math.random() * 30}%`, opacity: 1 - i * 0.1 }}
                />
              ))}
            </div>
          ) : loadState === "error" ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Folder className="w-7 h-7 text-[var(--text-dim)] opacity-40 mb-2 stroke-[1.5]" />
              <p className="text-xs text-[var(--text-dim)] text-center py-6 font-mono">
                Failed to read folder
              </p>
              <button
                onClick={handleRefresh}
                className="mt-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : (
            <FileTree
              files={hasNative ? [] : apiFiles}
              nativeTree={hasNative ? nativeTree : undefined}
              workspaceName={activeWorkspace.name || "Workspace"}
              workspaceFolderPath={activeWorkspace.rootPath || undefined}
              onFileClick={(p, n, content) => onOpenFileTab(p, n, content)}
              onRefresh={handleRefresh}
              onRenamePath={handleRenamePath}
              onDeletePath={handleDeletePath}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Folder className="w-8 h-8 text-[var(--text-muted)] opacity-35 mb-2 stroke-[1.5]" />
          <p className="text-xs text-[var(--text-dim)] font-normal">No folder opened</p>
        </div>
      )}

      {/* ── CANVAS SECTION (VS Code / Antigravity Outline Parity - Top 5 Recent Canvases) ── */}
      <div className="border-t border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col shrink-0">
        <button
          type="button"
          onClick={() => setIsCanvasSectionOpen(!isCanvasSectionOpen)}
          className="w-full h-7 px-3 flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors select-none cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform text-[var(--text-muted)]", !isCanvasSectionOpen && "-rotate-90")} />
            <PanelsTopLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.5} />
            <span className="font-semibold text-xs tracking-tight text-[var(--text-primary)]">Canvas</span>
            {recentCanvases.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--bg-card)] text-[var(--text-dim)] border border-[var(--border-color)] font-mono">
                {recentCanvases.length}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[var(--text-dim)] font-mono">top 5</span>
        </button>

        {isCanvasSectionOpen && (
          <div className="p-1 space-y-0.5 max-h-44 overflow-y-auto overflow-x-hidden select-none">
            {recentCanvases.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-[var(--text-dim)] italic">
                No recent canvas
              </div>
            ) : (
              recentCanvases.slice(0, 5).map((item) => {
                const formattedTitle = formatCanvasTitle(item.title);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenCanvasTab?.(item)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors group cursor-pointer"
                    title={`Open Canvas: ${formattedTitle}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PanelsTopLeft className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 transition-colors" strokeWidth={1.5} />
                      <span className="truncate text-[11px] font-normal text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                        {formattedTitle}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-dim)] shrink-0 ml-2 font-mono">
                      {item.timeStr || "open"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export const WorkstationLeftExplorer = memo(WorkstationLeftExplorerComponent);
