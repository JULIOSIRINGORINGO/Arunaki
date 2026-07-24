import { FolderOpen, MoreVertical, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

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

  const statusColors: Record<string, string> = {
    ready: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="relative p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <Link to={`/workspace/${id}`} className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FolderOpen
                className="text-purple-600 dark:text-purple-400"
                size={20}
              />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                {name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {fileCount} files
              </p>
            </div>
          </div>
        </Link>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <MoreVertical size={16} className="text-gray-500" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  onDelete?.(id);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span
          className={`px-2 py-0.5 text-xs rounded-full ${
            statusColors[status] || statusColors.pending
          }`}
        >
          {status}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
