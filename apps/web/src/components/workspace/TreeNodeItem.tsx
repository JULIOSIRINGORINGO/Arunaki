import { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
  Sparkles,
  MoreVertical,
  Copy,
} from "lucide-react";
import { TreeNode, getFileIcon, formatSize } from "./tree-utils";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  collapseSignal?: number;
  onFileClick?: (path: string, name: string) => void;
  onDeletePath?: (path: string, name: string) => void;
  onRenamePath?: (oldPath: string, oldName: string, newName: string) => void;
  onAnalyzeFile?: (name: string, path?: string) => void;
  activeAgentAction?: { toolName: string; args?: any } | null;
}

export function TreeNodeItem({
  node,
  depth,
  collapseSignal,
  onFileClick,
  onDeletePath,
  onRenamePath,
  onAnalyzeFile,
  activeAgentAction,
}: TreeNodeItemProps) {
  const [open, setOpen] = useState(depth < 2);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Sync editName when node.name changes
  useEffect(() => {
    setEditName(node.name);
  }, [node.name]);

  // Focus and preselect basename when entering rename mode
  useEffect(() => {
    if (isRenaming && editInputRef.current) {
      editInputRef.current.focus();
      const dotIndex = node.name.lastIndexOf(".");
      if (dotIndex > 0 && !node.isDir) {
        editInputRef.current.setSelectionRange(0, dotIndex);
      } else {
        editInputRef.current.select();
      }
    }
  }, [isRenaming, node.name, node.isDir]);

  // Auto-collapse when user triggers Collapse All Quick Action
  useEffect(() => {
    if (collapseSignal && collapseSignal > 0) {
      setOpen(false);
    }
  }, [collapseSignal]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleCommitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== node.name && onRenamePath) {
      onRenamePath(node.nativePath || node.name, node.name, trimmed);
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setEditName(node.name);
    setIsRenaming(false);
  };

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
          onClick={() => {
            if (!isRenaming) setOpen(!open);
          }}
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
              <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
            ) : (
              <Folder className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
            )}
            {isRenaming ? (
              <input
                ref={editInputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCommitRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelRename();
                  }
                }}
                onBlur={handleCommitRename}
                onClick={(e) => e.stopPropagation()}
                className="px-1.5 py-0.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--text-primary)] rounded text-xs font-medium w-full focus:outline-none select-text"
                autoFocus
              />
            ) : (
              <span className="truncate font-medium text-[var(--text-primary)] text-xs">
                {node.name}
              </span>
            )}
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              title="Folder Actions"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className={cn(
                "p-1 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded text-[var(--text-muted)] cursor-pointer transition-colors",
                menuOpen ? "opacity-100 text-[var(--text-primary)] bg-[var(--bg-hover)]" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-2xl p-1 z-50 animate-in fade-in duration-100 text-xs space-y-0.5"
              >
                {node.nativePath && onRenamePath && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setEditName(node.name);
                      setIsRenaming(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3 text-[var(--text-muted)]" />
                    <span>Rename / Edit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    const pathStr = node.nativePath || node.name;
                    navigator.clipboard.writeText(pathStr);
                    toast.success("Folder path copied to clipboard.");
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>Copy Path</span>
                </button>

                {node.nativePath && onDeletePath && (
                  <>
                    <div className="h-px bg-[var(--border-color)] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDeletePath(node.nativePath!, node.name);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                      <span>Delete Folder</span>
                    </button>
                  </>
                )}
              </div>
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
                onRenamePath={onRenamePath}
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
      onClick={() => {
        if (isRenaming) return;
        if (node.nativePath) onFileClick?.(node.nativePath, node.name);
        else onFileClick?.(node.name, node.name);
      }}
      className={`group flex items-center justify-between py-[3px] px-1.5 transition-all text-xs select-none cursor-pointer border-l-2 border-transparent ${
        isAgentTarget
          ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-semibold border-[var(--text-primary)] animate-pulse"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      }`}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {getFileIcon(node.name)}
        {isRenaming ? (
          <input
            ref={editInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleCommitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                handleCancelRename();
              }
            }}
            onBlur={handleCommitRename}
            onClick={(e) => e.stopPropagation()}
            className="px-1.5 py-0.5 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--text-primary)] rounded text-xs font-normal w-full focus:outline-none select-text"
            autoFocus
          />
        ) : (
          <span className="truncate text-[var(--text-primary)] font-normal">{node.name}</span>
        )}
        {isAgentTarget && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--text-primary)] text-[var(--bg-app)] text-[9px] font-bold shrink-0 animate-pulse">
            AI Working...
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 relative" ref={menuRef}>
        <span className="text-[10px] text-[var(--text-dim)] font-mono group-hover:hidden pr-1">
          {node.size ? formatSize(node.size) : node.file ? formatSize(node.file.size) : ""}
        </span>

        <button
          type="button"
          title="File Actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className={cn(
            "p-1 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded text-[var(--text-muted)] cursor-pointer transition-colors",
            menuOpen ? "opacity-100 text-[var(--text-primary)] bg-[var(--bg-hover)]" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-2xl p-1 z-50 animate-in fade-in duration-100 text-xs space-y-0.5"
          >
            {node.nativePath && onRenamePath && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditName(node.name);
                  setIsRenaming(true);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3 text-[var(--text-muted)]" />
                <span>Rename / Edit</span>
              </button>
            )}

            {onAnalyzeFile && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onAnalyzeFile(node.name, node.nativePath);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Ask AI to Analyze</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                const pathStr = node.nativePath || node.name;
                navigator.clipboard.writeText(pathStr);
                toast.success("File path copied to clipboard.");
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3 text-[var(--text-muted)]" />
              <span>Copy Path</span>
            </button>

            {node.nativePath && onDeletePath && (
              <>
                <div className="h-px bg-[var(--border-color)] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeletePath(node.nativePath!, node.name);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>Delete File</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
