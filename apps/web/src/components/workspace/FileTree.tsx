import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
}

// Native tree node from Electron IPC (getFolderTree)
interface NativeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  ext?: string;
  children?: NativeNode[];
}

interface TreeNode {
  name: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileItem;
  nativePath?: string;
  size?: number;
}

function buildTree(files: FileItem[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.name.replace(/\\/g, "/").split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.push({ name: part, isDir: false, children: [], file });
      } else {
        let existing = current.find((n) => n.name === part && n.isDir);
        if (!existing) {
          existing = { name: part, isDir: true, children: [] };
          current.push(existing);
        }
        current = existing.children;
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.isDir) sortNodes(n.children);
    });
  };
  sortNodes(root);

  return root;
}

// Convert native Electron tree to TreeNode format
function nativeToTreeNodes(nodes: NativeNode[]): TreeNode[] {
  return nodes.map((n) => ({
    name: n.name,
    isDir: n.type === "directory",
    nativePath: n.path,
    size: n.size,
    children: n.children ? nativeToTreeNodes(n.children) : [],
  }));
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return <FileText className="w-4 h-4 text-red-400" />;
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext))
    return <FileImage className="w-4 h-4 text-blue-400" />;
  if (["xlsx", "xls", "csv"].includes(ext))
    return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
  if (["md", "txt"].includes(ext)) return <FileText className="w-4 h-4 text-gray-400" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function TreeNodeItem({
  node,
  depth,
  onFileClick,
}: {
  node: TreeNode;
  depth: number;
  onFileClick?: (path: string, name: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2); // auto-expand first 2 levels

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 w-full text-left py-[3px] hover:bg-gray-50 rounded-md transition-colors text-sm text-gray-700"
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
        >
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
          <span className="truncate font-medium text-gray-800">{node.name}</span>
          {node.children.length > 0 && (
            <span className="ml-auto text-[10px] text-gray-400 shrink-0 pr-1">
              {node.children.length}
            </span>
          )}
        </button>
        {open && node.children.length > 0 && (
          <div>
            {node.children.map((child, i) => (
              <TreeNodeItem
                key={`${child.name}-${i}`}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
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
    <button
      onClick={() =>
        node.nativePath && onFileClick?.(node.nativePath, node.name)
      }
      className="flex items-center gap-1.5 w-full text-left py-[3px] hover:bg-gray-50 rounded-md transition-colors text-sm text-gray-500 group"
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate group-hover:text-gray-800 transition-colors">{node.name}</span>
      <span className="ml-auto text-[10px] text-gray-400 shrink-0 pr-1">
        {node.size ? formatSize(node.size) : node.file ? formatSize(node.file.size) : ""}
      </span>
    </button>
  );
}

interface FileTreeProps {
  files: FileItem[];
  workspaceName: string;
  nativeTree?: NativeNode[]; // from Electron IPC
  onFileClick?: (path: string, name: string) => void;
}

export default function FileTree({
  files,
  workspaceName,
  nativeTree,
  onFileClick,
}: FileTreeProps) {
  const [search, setSearch] = useState("");

  // Use native tree from Electron if available, else build from flat file list
  const tree = useMemo(() => {
    if (nativeTree && nativeTree.length > 0) {
      return nativeToTreeNodes(nativeTree);
    }
    return buildTree(files);
  }, [nativeTree, files]);

  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const lower = search.toLowerCase();
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map((node) => {
          if (node.isDir) {
            const children = filterNodes(node.children);
            if (
              children.length > 0 ||
              node.name.toLowerCase().includes(lower)
            ) {
              return { ...node, children };
            }
            return null;
          }
          if (node.name.toLowerCase().includes(lower)) return node;
          return null;
        })
        .filter(Boolean) as TreeNode[];
    };
    return filterNodes(tree);
  }, [tree, search]);

  // Count total files in tree
  const countFiles = (nodes: TreeNode[]): number =>
    nodes.reduce(
      (sum, n) => sum + (n.isDir ? countFiles(n.children) : 1),
      0
    );
  const totalFiles = countFiles(tree);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari file atau folder..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white placeholder:text-gray-400 focus:outline-none focus:border-gray-300"
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
        {filteredTree.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {search ? "Tidak ditemukan" : "Belum ada file"}
          </p>
        ) : (
          <div>
            {/* Root folder header */}
            <div className="flex items-center gap-1.5 py-1 px-1 text-sm text-gray-800 font-semibold mb-0.5">
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">{workspaceName}</span>
              <span className="ml-auto text-[10px] text-gray-400 font-normal shrink-0">
                {totalFiles} file
              </span>
            </div>
            {filteredTree.map((node, i) => (
              <TreeNodeItem
                key={`${node.name}-${i}`}
                node={node}
                depth={1}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

