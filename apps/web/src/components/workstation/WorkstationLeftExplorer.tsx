import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Folder, PanelLeftClose, PanelLeftOpen, RotateCw } from "lucide-react";
import FileTree from "../workspace/FileTree";
import { NativeNode } from "../workspace/tree-utils";

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
}

type LoadState = "idle" | "loading" | "done" | "error";

function WorkstationLeftExplorerComponent({
  collapsed,
  onClose,
  activeWorkspace,
  workspaceFiles,
  onOpenFileTab,
  width = 256,
  onNativeFilesChange,
}: WorkstationLeftExplorerProps) {
  const [nativeTree, setNativeTree] = useState<NativeNode[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
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
          <PanelLeftOpen className="w-4 h-4 text-[var(--text-primary)]" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-4 text-[var(--text-muted)]">
          <Folder className="w-4 h-4 opacity-40" />
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
          <Folder className="w-3.5 h-3.5 text-[var(--text-muted)]" />
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
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Close Explorer"
          >
            <PanelLeftClose className="w-4 h-4" />
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
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Folder className="w-8 h-8 text-[var(--text-muted)] opacity-35 mb-2 stroke-[1.5]" />
          <p className="text-xs text-[var(--text-dim)] font-normal">No folder opened</p>
        </div>
      )}
    </aside>
  );
}

export const WorkstationLeftExplorer = memo(WorkstationLeftExplorerComponent);
