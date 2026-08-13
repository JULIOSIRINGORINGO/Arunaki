import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Edit3, Trash2, Sparkles } from "lucide-react";
import { TreeNode, getFileIcon, formatSize } from "./tree-utils";

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  onFileClick?: (path: string, name: string) => void;
  onDeletePath?: (path: string, name: string) => void;
  onRenameClick?: (path: string, currentName: string) => void;
  onAnalyzeFile?: (name: string, path?: string) => void;
  activeAgentAction?: { toolName: string; args?: any } | null;
}

export function TreeNodeItem({
  node,
  depth,
  onFileClick,
  onDeletePath,
  onRenameClick,
  onAnalyzeFile,
  activeAgentAction,
}: TreeNodeItemProps) {
  const [open, setOpen] = useState(depth < 2);
  const isAgentTarget = Boolean(
    activeAgentAction?.args?.filename &&
      (activeAgentAction.args.filename.endsWith(node.name) ||
        node.name.endsWith(activeAgentAction.args.filename))
  );

  if (node.isDir) {
    return (
      <div>
        <div
          className="group flex items-center justify-between py-[3px] px-1 hover:bg-gray-100/80 rounded-md transition-colors text-sm text-gray-700 select-none cursor-pointer"
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="shrink-0 text-gray-400">
              {open ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            {open ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate font-medium text-gray-800 text-xs">{node.name}</span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.nativePath && onRenameClick && (
              <button
                type="button"
                title="Ubah Nama Folder"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameClick(node.nativePath!, node.name);
                }}
                className="p-1 hover:bg-gray-200 hover:text-gray-900 rounded text-gray-400 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
            {node.nativePath && onDeletePath && (
              <button
                type="button"
                title="Hapus Folder"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePath(node.nativePath!, node.name);
                }}
                className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            {node.children.length > 0 && (
              <span className="text-[10px] text-gray-400 font-mono px-1">
                {node.children.length}
              </span>
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
            className="text-[11px] text-gray-400 italic py-1"
            style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
          >
            folder kosong
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
      className={`group flex items-center justify-between py-[3px] px-1 rounded-md transition-all text-xs text-gray-600 select-none cursor-pointer ${
        isAgentTarget ? "bg-amber-100/90 text-amber-900 font-semibold ring-1 ring-amber-400 animate-pulse" : "hover:bg-gray-100/90"
      }`}
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {getFileIcon(node.name)}
        <span className="truncate group-hover:text-gray-900 font-normal">{node.name}</span>
        {isAgentTarget && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold shrink-0 animate-pulse">
            🤖 AI Working...
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-gray-400 font-mono group-hover:hidden">
          {node.size ? formatSize(node.size) : node.file ? formatSize(node.file.size) : ""}
        </span>

        <div className="hidden group-hover:flex items-center gap-0.5">
          {onAnalyzeFile && (
            <button
              type="button"
              title="Minta AI Analisis File Ini"
              onClick={(e) => {
                e.stopPropagation();
                onAnalyzeFile(node.name, node.nativePath);
              }}
              className="p-1 hover:bg-amber-100 hover:text-amber-700 rounded text-amber-500 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
            </button>
          )}
          {node.nativePath && onRenameClick && (
            <button
              type="button"
              title="Ubah Nama File"
              onClick={(e) => {
                e.stopPropagation();
                onRenameClick(node.nativePath!, node.name);
              }}
              className="p-1 hover:bg-gray-200 hover:text-gray-900 rounded text-gray-400 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
          {node.nativePath && onDeletePath && (
            <button
              type="button"
              title="Hapus File"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePath(node.nativePath!, node.name);
              }}
              className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-400 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
