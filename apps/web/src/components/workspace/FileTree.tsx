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
  FilePlus, 
  FolderPlus, 
  RotateCw, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  FileCode, 
  Sparkles, 
  ExternalLink 
} from "lucide-react";
import { toast } from "sonner";

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

function isBinaryFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["pdf", "docx", "doc", "zip", "rar", "png", "jpg", "jpeg", "gif", "exe", "bin", "pptx", "ppt", "xlsx", "xlsm", "xls"].includes(ext);
}

function isOfficeDocument(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["xlsx", "xlsm", "xls", "csv", "docx", "doc", "pptx", "ppt"].includes(ext);
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
  if (["pdf"].includes(ext)) return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext))
    return <FileImage className="w-4 h-4 text-blue-500 shrink-0" />;
  if (["xlsx", "xls", "xlsm", "csv"].includes(ext))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (["json", "js", "ts", "tsx", "html", "css", "py"].includes(ext))
    return <FileCode className="w-4 h-4 text-purple-500 shrink-0" />;
  if (["md", "txt"].includes(ext)) return <FileText className="w-4 h-4 text-gray-500 shrink-0" />;
  return <File className="w-4 h-4 text-gray-400 shrink-0" />;
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function TreeNodeItem({
  node,
  depth,
  onFileClick,
  onDeletePath,
  onRenameClick,
  onAnalyzeFile,
  activeAgentAction,
}: {
  node: TreeNode;
  depth: number;
  onFileClick?: (path: string, name: string) => void;
  onDeletePath?: (path: string, name: string) => void;
  onRenameClick?: (path: string, currentName: string) => void;
  onAnalyzeFile?: (name: string, path?: string) => void;
  activeAgentAction?: { toolName: string; args?: any } | null;
}) {
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
                className="p-1 hover:bg-gray-200 hover:text-gray-900 rounded text-gray-400"
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
                className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-400"
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
              className="p-1 hover:bg-amber-100 hover:text-amber-700 rounded text-amber-500 transition-colors"
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
              className="p-1 hover:bg-gray-200 hover:text-gray-900 rounded text-gray-400"
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
              className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FileTreeProps {
  files: FileItem[];
  workspaceName: string;
  workspaceFolderPath?: string;
  nativeTree?: NativeNode[]; // from Electron IPC
  onFileClick?: (path: string, name: string) => void;
  onRefresh?: () => void;
  onCreateFile?: (fileName: string) => void;
  onCreateFolder?: (folderName: string) => void;
  onDeletePath?: (path: string, name: string) => void;
  onRenamePath?: (oldPath: string, oldName: string, newName: string) => void;
  onAnalyzeFile?: (name: string, path?: string) => void;
  activeAgentAction?: { toolName: string; args?: any } | null;
}

export default function FileTree({
  files,
  workspaceName,
  workspaceFolderPath,
  nativeTree,
  onFileClick,
  onRefresh,
  onCreateFile,
  onCreateFolder,
  onDeletePath,
  onRenamePath,
  onAnalyzeFile,
  activeAgentAction,
}: FileTreeProps) {
  const [search, setSearch] = useState("");
  const [activeFile, setActiveFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New File / Folder Prompt Modal
  const [promptModal, setPromptModal] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");

  // Rename File / Folder Modal
  const [renameModalState, setRenameModalState] = useState<{ oldPath: string; oldName: string } | null>(null);
  const [renameNewName, setRenameNewName] = useState("");

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

  const countFiles = (nodes: TreeNode[]): number =>
    nodes.reduce(
      (sum, n) => sum + (n.isDir ? countFiles(n.children) : 1),
      0
    );
  const totalFiles = countFiles(tree);

  const handleItemClick = async (filePath: string, fileName: string) => {
    try {
      if (onFileClick) {
        onFileClick(filePath, fileName);
        return;
      }

      // Fallback: Open natively in OS external application if no callback provided
      if (isOfficeDocument(fileName)) {
        if ((window as any).arunakiDesktop?.openExcelNative) {
          (window as any).arunakiDesktop.openExcelNative(filePath);
        } else if ((window as any).arunakiDesktop?.openPath) {
          (window as any).arunakiDesktop.openPath(filePath);
        } else {
          toast.info("Fitur buka native hanya tersedia di aplikasi desktop Arunaki.");
        }
        return;
      }

      if (isBinaryFile(fileName)) {
        setActiveFile({
          path: filePath,
          name: fileName,
          content: "",
        });
        setIsEditing(false);
        return;
      }

      if ((window as any).arunakiDesktop?.readFile) {
        const res = await (window as any).arunakiDesktop.readFile(filePath);
        if (res?.error) {
          toast.error(`Gagal membaca file: ${res.error}`);
          return;
        }
        setActiveFile({
          path: filePath,
          name: fileName,
          content: res.content || "",
        });
        setIsEditing(false);
      }
    } catch (err: any) {
      console.error("Error opening file:", err);
      setActiveFile({
        path: filePath,
        name: fileName,
        content: "",
      });
      setIsEditing(false);
    }
  };

  const handleSaveFileContent = async () => {
    if (!activeFile || isBinaryFile(activeFile.name)) return;
    setIsSaving(true);
    try {
      if ((window as any).arunakiDesktop?.writeFile) {
        const res = await (window as any).arunakiDesktop.writeFile(activeFile.path, activeFile.content);
        if (res?.error) {
          toast.error(`Gagal menyimpan file: ${res.error}`);
        } else {
          toast.success(`File "${activeFile.name}" berhasil disimpan!`);
          setIsEditing(false);
          if (onRefresh) onRefresh();
        }
      } else {
        toast.info("Penyimpanan file didukung pada mode Desktop Electron.");
      }
    } catch (err: any) {
      toast.error(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    if (promptModal === "file" && onCreateFile) {
      onCreateFile(newItemName.trim());
    } else if (promptModal === "folder" && onCreateFolder) {
      onCreateFolder(newItemName.trim());
    }
    setPromptModal(null);
    setNewItemName("");
  };

  const handleOpenRenameModal = (path: string, currentName: string) => {
    setRenameModalState({ oldPath: path, oldName: currentName });
    setRenameNewName(currentName);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameModalState || !renameNewName.trim()) return;

    if (onRenamePath) {
      onRenamePath(renameModalState.oldPath, renameModalState.oldName, renameNewName.trim());
    }
    setRenameModalState(null);
    setRenameNewName("");
  };

  const activeContentIsRawBinary = useMemo(() => {
    if (!activeFile?.content) return false;
    return activeFile.content.startsWith("PK\x03\x04") || activeFile.content.startsWith("PK") || isBinaryFile(activeFile.name);
  }, [activeFile]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
      {/* VS Code Style Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/70">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-semibold text-xs text-gray-800 truncate" title={workspaceName}>
            {workspaceName}
          </span>
        </div>

        {/* Action Icons (VS Code Explorer Actions) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            title="Tambah File Baru"
            onClick={() => {
              setNewItemName("");
              setPromptModal("file");
            }}
            className="p-1 hover:bg-gray-200/80 rounded text-gray-600 hover:text-gray-900 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="Tambah Folder Baru"
            onClick={() => {
              setNewItemName("");
              setPromptModal("folder");
            }}
            className="p-1 hover:bg-gray-200/80 rounded text-gray-600 hover:text-gray-900 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {onRefresh && (
            <button
              type="button"
              title="Refresh Struktur Direktori"
              onClick={onRefresh}
              className="p-1 hover:bg-gray-200/80 rounded text-gray-600 hover:text-gray-900 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-gray-100 bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari file atau folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded-md text-xs bg-gray-50/50 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-gray-300"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1.5 min-h-0">
        {filteredTree.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            {search ? "File/folder tidak ditemukan" : "Belum ada file di workspace ini"}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filteredTree.map((node, i) => (
              <TreeNodeItem
                key={`${node.name}-${i}`}
                node={node}
                depth={0}
                onFileClick={handleItemClick}
                onDeletePath={onDeletePath}
                onRenameClick={handleOpenRenameModal}
                onAnalyzeFile={onAnalyzeFile}
                activeAgentAction={activeAgentAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/40 text-[10px] text-gray-400 flex items-center justify-between">
        <span>{totalFiles} file terdaftar</span>
        {workspaceFolderPath && <span className="truncate max-w-[120px] font-mono">{workspaceFolderPath}</span>}
      </div>

      {/* Modal Prompt Tambah File / Folder */}
      {promptModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                {promptModal === "file" ? (
                  <>
                    <FilePlus className="w-4 h-4 text-blue-500" /> Tambah File Baru
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4 text-amber-500" /> Tambah Folder Baru
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setPromptModal(null)}
                className="text-gray-400 hover:text-gray-600 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewItemSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Nama {promptModal === "file" ? "File (contoh: catatan.txt, data.json)" : "Folder"}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={promptModal === "file" ? "nama-file.txt" : "nama-folder"}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPromptModal(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!newItemName.trim()}
                  className="px-3 py-1.5 text-xs bg-gray-900 hover:bg-black text-white font-medium rounded-md disabled:opacity-50"
                >
                  Buat {promptModal === "file" ? "File" : "Folder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Prompt Rename File / Folder */}
      {renameModalState && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-500" /> Ubah Nama File / Folder
              </h3>
              <button
                type="button"
                onClick={() => setRenameModalState(null)}
                className="text-gray-400 hover:text-gray-600 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Nama Baru
                </label>
                <input
                  type="text"
                  autoFocus
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRenameModalState(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!renameNewName.trim() || renameNewName === renameModalState.oldName}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50"
                >
                  Ubah Nama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VS Code Style Text Editor / Viewer Modal */}
      {activeFile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Editor Header Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 text-white border-b border-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-semibold text-xs truncate">{activeFile.name}</span>
                <span className="text-[10px] text-gray-400 font-mono truncate hidden sm:inline">{activeFile.path}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!activeContentIsRawBinary && (
                  !isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700 transition-colors"
                    >
                      <Edit3 className="w-3 h-3 text-amber-400" />
                      <span>Edit Content</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveFileContent}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors"
                    >
                      <Save className="w-3 h-3" />
                      <span>{isSaving ? "Menyimpan..." : "Simpan"}</span>
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setActiveFile(null)}
                  className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Area / Binary File View */}
            {activeContentIsRawBinary ? (
              <div className="flex-1 bg-gray-900 text-gray-100 p-8 flex flex-col items-center justify-center text-center space-y-4">
                <FileSpreadsheet className="w-16 h-16 text-emerald-500 animate-pulse shrink-0" />
                <div className="max-w-md space-y-1">
                  <h4 className="font-bold text-base text-white">{activeFile.name}</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Dokumen ini adalah format biner terkompresi. Anda dapat membukanya di OnlyOffice Host atau aplikasi OS bawaan.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if ((window as any).arunakiDesktop?.openPath) {
                        (window as any).arunakiDesktop.openPath(activeFile.path);
                        toast.success(`Membuka "${activeFile.name}" di aplikasi OS bawaan...`);
                      } else {
                        toast.info("Fitur membuka di aplikasi OS bawaan membutuhkan Desktop Electron.");
                      }
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka di Aplikasi OS Bawaan</span>
                  </button>

                  {onAnalyzeFile && (
                    <button
                      type="button"
                      onClick={() => {
                        const name = activeFile.name;
                        const path = activeFile.path;
                        setActiveFile(null);
                        onAnalyzeFile(name, path);
                      }}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Minta AI Analisis Dokumen Ini</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-gray-950 text-gray-100 p-4 font-mono text-xs overflow-auto">
                {isEditing ? (
                  <textarea
                    value={activeFile.content}
                    onChange={(e) => setActiveFile({ ...activeFile, content: e.target.value })}
                    className="w-full h-full bg-transparent text-gray-100 resize-none outline-none font-mono leading-relaxed"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-200">
                    {activeFile.content || "(File kosong)"}
                  </pre>
                )}
              </div>
            )}

            {/* Editor Footer */}
            <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
              <span>
                {activeContentIsRawBinary
                  ? "Pratinjau File Biner Terkompresi"
                  : isEditing
                  ? "Mode Edit (Aktif)"
                  : "Mode Pratinjau (Read-Only)"}
              </span>
              <button
                type="button"
                onClick={() => setActiveFile(null)}
                className="hover:text-gray-200"
              >
                Tutup Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
