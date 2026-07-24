/* Hallmark · component: workspace-card · genre: atmospheric · theme: Studio */
import { FolderOpen, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";

interface WorkspaceCardProps {
  id: string;
  name: string;
  status: string;
  fileCount?: number;
  createdAt: string;
  onDelete?: (id: string) => void;
}

export function WorkspaceCard({
  id,
  name,
  status,
  fileCount = 0,
  createdAt,
  onDelete,
}: WorkspaceCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    ready: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
    processing: { bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
    pending: { bg: "bg-surface-200", text: "text-surface-500", dot: "bg-surface-400" },
  };

  const s = statusConfig[status] || statusConfig.pending;

  return (
    <div className="relative p-4 border border-surface-200 rounded-lg bg-surface-100 hover:bg-surface-200 hover:border-surface-300 transition-all duration-150 group">
      <div className="flex items-start justify-between mb-3">
        <Link to={`/workspace/${id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <FolderOpen className="text-accent" size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-surface-800 truncate text-[13px]">
                {name}
              </h3>
              <p className="text-[11px] text-surface-500">
                {fileCount} files
              </p>
            </div>
          </div>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-300 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical size={14} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-7 w-36 bg-surface-100 border border-surface-200 rounded-lg shadow-lg z-10 py-1 animate-fade-in">
              <Link
                to={`/workspace/${id}`}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[12px] text-surface-700 hover:bg-surface-200 transition-colors"
                onClick={() => setShowMenu(false)}
              >
                <ExternalLink size={12} />
                Buka
              </Link>
              <button
                onClick={() => {
                  onDelete?.(id);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[12px] text-error hover:bg-surface-200 transition-colors"
              >
                <Trash2 size={12} />
                Hapus
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded",
            s.bg,
            s.text
          )}
        >
          <span className={cn("w-1 h-1 rounded-full", s.dot)} />
          {status}
        </span>
        <span className="text-[10px] text-surface-500">
          {new Date(createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
