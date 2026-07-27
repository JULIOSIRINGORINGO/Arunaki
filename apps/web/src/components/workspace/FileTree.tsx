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

interface TreeNode {
  name: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileItem;
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

  // Sort: folders first, then files, alphabetical
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

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return <FileText className="w-4 h-4 text-gray-400" />;
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext))
    return <FileImage className="w-4 h-4 text-gray-400" />;
  if (["xlsx", "xls", "csv"].includes(ext))
    return <FileSpreadsheet className="w-4 h-4 text-gray-400" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function TreeNodeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(true);

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 w-full text-left py-0.5 hover:bg-gray-100 rounded px-1 text-sm text-gray-700"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          )}
          {open ? (
            <FolderOpen className="w-4 h-4 text-gray-500 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-gray-500 shrink-0" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child, i) => (
              <TreeNodeItem key={`${child.name}-${i}`} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 py-0.5 text-sm text-gray-500"
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
      <span className="ml-auto text-xs text-gray-400 shrink-0">
        {node.file ? formatSize(node.file.size) : ""}
      </span>
    </div>
  );
}

interface FileTreeProps {
  files: FileItem[];
  workspaceName: string;
}

export default function FileTree({ files, workspaceName }: FileTreeProps) {
  const [search, setSearch] = useState("");
  const tree = useMemo(() => buildTree(files), [files]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari file..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:border-gray-300"
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredTree.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {search ? "Tidak ditemukan" : "Belum ada file"}
          </p>
        ) : (
          <div className="space-y-0.5">
            {/* Root folder header */}
            <div className="flex items-center gap-1.5 py-0.5 text-sm text-gray-700 font-medium">
              <FolderOpen className="w-4 h-4 text-gray-500" />
              <span className="truncate">{workspaceName}</span>
            </div>
            {filteredTree.map((node, i) => (
              <TreeNodeItem key={`${node.name}-${i}`} node={node} depth={1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
