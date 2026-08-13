import { useState, useMemo } from "react";
import {
  FolderOpen,
  Search,
  FilePlus,
  FolderPlus,
  RotateCw,
} from "lucide-react";
import {
  FileItem,
  NativeNode,
  TreeNode,
  buildTree,
  nativeToTreeNodes,
} from "./tree-utils";
import { TreeNodeItem } from "./TreeNodeItem";
import { API_BASE, apiFetch } from "../../lib/api";

export interface FileTreeProps {
  files: FileItem[];
  workspaceName: string;
  workspaceFolderPath?: string;
  nativeTree?: NativeNode[];
  onFileClick?: (path: string, name: string, content?: string) => void;
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
  const [promptModal, setPromptModal] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");
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
            if (children.length > 0 || node.name.toLowerCase().includes(lower)) {
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

  const handleItemClick = async (filePath: string, fileName: string) => {
    try {
      let fileContent = "";
      if ((window as any).arunakiDesktop?.readFile) {
        const res = await (window as any).arunakiDesktop.readFile(filePath);
        if (res?.content) fileContent = res.content;
      } else {
        const targetFile = files.find((f) => f.name.endsWith(fileName) || fileName.endsWith(f.name));
        if (targetFile?.id) {
          try {
            const res = await apiFetch(`${API_BASE}/files/${targetFile.id}/content`);
            const data = await res.json();
            if (data.data?.content) fileContent = data.data.content;
          } catch {}
        }
      }

      if (onFileClick) {
        onFileClick(filePath, fileName, fileContent);
      }
    } catch (err: any) {
      console.error("Error opening file:", err);
    }
  };

  const handleCreateNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    if (promptModal === "file" && onCreateFile) onCreateFile(newItemName.trim());
    else if (promptModal === "folder" && onCreateFolder) onCreateFolder(newItemName.trim());
    setPromptModal(null);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[24px] border border-stone-800/10 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 h-11 min-h-[44px] bg-[#1A191B] shrink-0 border-b border-stone-800/40 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="w-4 h-4 text-[#C4B5FD] shrink-0" />
          <span className="text-[#F4EFE6] font-bold text-xs tracking-wide truncate" title={workspaceName}>
            {workspaceName || "Workspace"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="Tambah File Baru"
            onClick={() => {
              setNewItemName("");
              setPromptModal("file");
            }}
            className="p-1.5 hover:bg-stone-800 text-[#C4B5FD] hover:text-white rounded-lg transition-colors cursor-pointer"
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
            className="p-1.5 hover:bg-stone-800 text-[#C4B5FD] hover:text-[#FF5E38] rounded-lg transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {onRefresh && (
            <button
              type="button"
              title="Refresh Struktur Direktori"
              onClick={onRefresh}
              className="p-1.5 hover:bg-stone-800 text-[#C4B5FD] hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

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
                onFileClick={(p, n) => handleItemClick(p, n)}
                onDeletePath={onDeletePath}
                onRenameClick={(p, n) => {
                  setRenameModalState({ oldPath: p, oldName: n });
                  setRenameNewName(n);
                }}
                onAnalyzeFile={onAnalyzeFile}
                activeAgentAction={activeAgentAction}
              />
            ))}
          </div>
        )}
      </div>

      {promptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl border border-gray-200">
            <h4 className="text-xs font-bold text-gray-900 mb-3">
              {promptModal === "file" ? "Tambah File Baru" : "Tambah Folder Baru"}
            </h4>
            <form onSubmit={handleCreateNewItemSubmit} className="space-y-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={promptModal === "file" ? "contoh: Laporan.xlsx" : "contoh: DokumenUsaha"}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#FF5E38]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPromptModal(null)}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#FF5E38] text-white text-xs rounded-lg font-medium"
                >
                  Buat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renameModalState && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl border border-gray-200">
            <h4 className="text-xs font-bold text-gray-900 mb-3">Ubah Nama File / Folder</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onRenamePath && renameNewName.trim()) {
                  onRenamePath(renameModalState.oldPath, renameModalState.oldName, renameNewName.trim());
                }
                setRenameModalState(null);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#FF5E38]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameModalState(null)}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#FF5E38] text-white text-xs rounded-lg font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
