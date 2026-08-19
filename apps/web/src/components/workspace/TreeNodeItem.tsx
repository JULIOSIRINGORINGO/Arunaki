import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2, Sparkles } from "lucide-react";
import { TreeNode, getFileIcon, formatSize } from "./tree-utils";

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  collapseSignal?: number;
  onFileClick?: (path: string, name: string) => void;
  onDeletePath?: (path: string, name: string) => void;
  onRenameClick?: (path: string, currentName: string) => void;
  onAnalyzeFile?: (name: string, path?: string) => void;
  activeAgentAction?: { toolName: string; args?: any } | null;
}

export function TreeNodeItem({
  node,
  depth,
  collapseSignal,
  onFileClick,
  onDeletePath,
  onRenameClick,
  onAnalyzeFile,
  activeAgentAction,
}: TreeNodeItemProps) {
  const [open, setOpen] = useState(depth < 2);

  // Auto-collapse when user triggers Collapse All Quick Action
  useEffect(() => {
    if (collapseSignal && collapseSignal > 0) {
      setOpen(false);
    }
  }, [collapseSignal]);

  const isAgentTarget = Boolean(
    activeAgentAction?.args?.filename &&
      (activeAgentAction.args.filename.endsWith(node.name) ||
        node.name.endsWith(activeAgentAction.args.filename))
  );

  if (node.isDir) {
    return (
      <div>
        <div
          className="group flex items-center justify-between py-[3px] px-1.5 hover:bg-[var(--bg-hover)] transition-colors text-xs text-[var(--text-primary)] select-none cursor-pointer border-l-2 border-transparent hover:border-[var(--border-strong)]"
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="shrink-0 text-[var(--text-muted)]">
              {open ? (
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
            </span>
            {open ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500/90 dark:text-amber-400/90 shrink-0" strokeWidth={1.5} />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500/80 dark:text-amber-400/80 shrink-0" strokeWidth={1.5} />
            )}
            <span className="truncate font-medium text-[var(--text-primary)] text-xs">
              {node.name}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.nativePath && onRenameClick && (
              <button
                type="button"
                title="Rename Folder"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameClick(node.nativePath!, node.name);
                }}
                className="p-1 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded text-[var(--text-muted)] cursor-pointer transition-colors"
              >
                <Pencil className="w-3 h-3" strokeWidth={1.5} />
              </button>
            )}
            {node.nativePath && onDeletePath && (
              <button
                type="button"
                title="Delete Folder"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePath(node.nativePath!, node.name);
                }}
                className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded text-[var(--text-muted)] cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {open && node.children.length > 0 && (
          <div>
            {node.children.map((child, i) => (
              <TreeNodeItem
                key={`${child.name}-${i}`}
                node={child}
                depth={depth + 1}
                collapseSignal={collapseSignal}
                onFileClick={onFileClick}
                onDeletePath={onDeletePath}
                onRenameClick={onRenameClick}
                onAnalyzeFile={onAnalyzeFile}
                activeAgentAction={activeAgentAction}
              />
            ))}
          </div>
        )}
        {open && node.children.length === 0 && (
          <div
            className="text-[11px] text-[var(--text-dim)] italic py-0.5"
            style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}
          >
            (kosong)
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() =>
        node.nativePath
          ? onFileClick?.(node.nativePath, node.name)
          : onFileClick?.(node.name, node.name)
      }
      className={`group flex items-center justify-between py-[3px] px-1.5 transition-all text-xs select-none cursor-pointer border-l-2 border-transparent ${
        isAgentTarget
          ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-semibold border-[var(--text-primary)] animate-pulse"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      }`}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {getFileIcon(node.name)}
        <span className="truncate text-[var(--text-primary)] font-normal">{node.name}</span>
        {isAgentTarget && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--text-primary)] text-[var(--bg-app)] text-[9px] font-bold shrink-0 animate-pulse">
            AI Working...
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-[var(--text-dim)] font-mono group-hover:hidden pr-1">
          {node.size ? formatSize(node.size) : node.file ? formatSize(node.file.size) : ""}
        </span>

        <div className="hidden group-hover:flex items-center gap-0.5">
          {onAnalyzeFile && (
            <button
              type="button"
              title="Ask AI to Analyze This File"
              onClick={(e) => {
                e.stopPropagation();
                onAnalyzeFile(node.name, node.nativePath);
              }}
              className="p-1 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded text-[var(--text-muted)] transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}
          {node.nativePath && onRenameClick && (
            <button
              type="button"
              title="Rename File"
              onClick={(e) => {
                e.stopPropagation();
                onRenameClick(node.nativePath!, node.name);
              }}
              className="p-1 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded text-[var(--text-muted)] cursor-pointer transition-colors"
            >
              <Pencil className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}
          {node.nativePath && onDeletePath && (
            <button
              type="button"
              title="Delete File"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePath(node.nativePath!, node.name);
              }}
              className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded text-[var(--text-muted)] cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
