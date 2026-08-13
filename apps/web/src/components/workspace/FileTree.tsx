import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderPlus,
  RotateCw,
  ChevronsUp,
} from "lucide-react";
import {
  FileItem,
  NativeNode,
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
  const [isRootExpanded, setIsRootExpanded] = useState(true);
  const [collapseSignal, setCollapseSignal] = useState(0);
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
    setNewItemName("");
  };

  const handleCollapseAll = () => {
    setCollapseSignal((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] overflow-hidden text-xs select-none">
      {/* 1. PROJECT ROOT BAR: Root Name + Chevron Toggle (Left) + 4 Quick Actions (Right) */}
      <div className="flex items-center justify-between px-3 h-8 bg-[#161616] shrink-0 border-b border-[#383838]">
        <button
          onClick={() => setIsRootExpanded(!isRootExpanded)}
          className="flex items-center gap-1.5 min-w-0 text-left hover:text-white transition-colors cursor-pointer group"
          title="Toggle Project Root"
        >
          <span className="text-[#A3A3A3] group-hover:text-white shrink-0">
            {isRootExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
          <span className="text-[#FFFFFF] font-semibold text-xs tracking-wide truncate">
            {workspaceName || "Workspace"}
          </span>
        </button>

        {/* 4 Quick Action Buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            title="New File (Tambah File Baru)"
            onClick={() => {
              setNewItemName("");
              setPromptModal("file");
            }}
            className="p-1 hover:bg-[#262626] text-[#A3A3A3] hover:text-white rounded transition-colors cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="New Folder (Tambah Folder Baru)"
            onClick={() => {
              setNewItemName("");
              setPromptModal("folder");
            }}
            className="p-1 hover:bg-[#262626] text-[#A3A3A3] hover:text-white rounded transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {onRefresh && (
            <button
              type="button"
              title="Refresh Explorer (Muat Ulang)"
              onClick={onRefresh}
              className="p-1 hover:bg-[#262626] text-[#A3A3A3] hover:text-white rounded transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            title="Collapse All Folders (Tutup Semua Folder)"
            onClick={handleCollapseAll}
            className="p-1 hover:bg-[#262626] text-[#A3A3A3] hover:text-white rounded transition-colors cursor-pointer"
          >
            <ChevronsUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. FLAT TREE LIST (Direct Hierarchy List with Compact Indentation) */}
      {isRootExpanded && (
        <div className="flex-1 overflow-y-auto py-1 min-h-0">
          {tree.length === 0 ? (
            <p className="text-xs text-[#737373] text-center py-6 font-mono">
              (Belum ada file di workspace ini)
            </p>
          ) : (
            <div className="space-y-0.5">
              {tree.map((node, i) => (
                <TreeNodeItem
                  key={`${node.name}-${i}`}
                  node={node}
                  depth={0}
                  collapseSignal={collapseSignal}
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
      )}

      {/* Modals for Create & Rename */}
      {promptModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#171717] rounded-xl p-5 max-w-xs w-full shadow-2xl border border-[#383838]">
            <h4 className="text-xs font-bold text-white mb-3">
              {promptModal === "file" ? "Tambah File Baru" : "Tambah Folder Baru"}
            </h4>
            <form onSubmit={handleCreateNewItemSubmit} className="space-y-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={promptModal === "file" ? "contoh: Laporan.xlsx" : "contoh: DokumenUsaha"}
                className="w-full bg-[#1E1E1E] border border-[#383838] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#666666]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPromptModal(null)}
                  className="px-3 py-1 bg-[#262626] text-[#A3A3A3] hover:text-white text-xs rounded-md font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-white text-black hover:bg-[#E5E5E5] text-xs rounded-md font-semibold cursor-pointer"
                >
                  Buat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renameModalState && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#171717] rounded-xl p-5 max-w-xs w-full shadow-2xl border border-[#383838]">
            <h4 className="text-xs font-bold text-white mb-3">Ubah Nama File / Folder</h4>
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
                className="w-full bg-[#1E1E1E] border border-[#383838] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#666666]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameModalState(null)}
                  className="px-3 py-1 bg-[#262626] text-[#A3A3A3] hover:text-white text-xs rounded-md font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-white text-black hover:bg-[#E5E5E5] text-xs rounded-md font-semibold cursor-pointer"
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
