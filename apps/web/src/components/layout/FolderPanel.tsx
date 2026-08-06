import { useQuery } from "@tanstack/react-query";
import { FileText, FolderOpen, RefreshCw } from "lucide-react";
import { API_BASE, apiFetch } from "../../lib/api";

interface FolderPanelProps {
  workspaceId?: string | null;
}

const fileTypeColors: Record<string, string> = {
  pdf: "text-red-500",
  xlsx: "text-[#FF5E38]",
  xls: "text-[#FF5E38]",
  csv: "text-[#FF5E38]",
  docx: "text-blue-500",
  doc: "text-blue-500",
  txt: "text-stone-500",
  md: "text-purple-500",
};

function getFileColor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return fileTypeColors[ext] || "text-stone-500";
}

export function FolderPanel({ workspaceId }: FolderPanelProps) {
  const effectiveId = workspaceId || localStorage.getItem("arunaki_workspace_id");

  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ["files", effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      try {
        const res = await apiFetch(`${API_BASE}/files/workspace/${effectiveId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!effectiveId,
  });

  return (
    <div className="bg-white rounded-[24px] overflow-hidden flex flex-col h-full shadow-sm border border-stone-200/50 w-72 min-w-[280px] max-w-[320px] shrink-0 select-none">
      {/* Dark Top Header Bar */}
      <div className="bg-[#1A191B] h-11 min-h-[44px] px-5 flex items-center justify-between shrink-0">
        <span className="text-[#FF5E38] font-bold text-xs tracking-wide">
          Folder
        </span>
        <button
          onClick={() => refetch()}
          className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          title="Refresh Folder"
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* White Folder Content Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-white space-y-1">
        {!effectiveId ? (
          <div className="text-center py-12 text-stone-400 space-y-2">
            <FolderOpen className="mx-auto text-stone-300" size={28} />
            <p className="text-xs font-medium">Belum ada folder terhubung</p>
            <p className="text-[10px] text-stone-400 px-4">
              Klik "open folder" di header atas untuk menghubungkan workspace.
            </p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-stone-400 space-y-2">
            <FolderOpen className="mx-auto text-stone-300" size={28} />
            <p className="text-xs font-medium">Folder Kosong</p>
            <p className="text-[10px] text-stone-400 px-4">
              Belum ada file terdeteksi di folder ini.
            </p>
          </div>
        ) : (
          files.map((file: any) => (
            <div
              key={file.id || file.name}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer group"
            >
              <FileText size={14} className={`${getFileColor(file.name)} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-700 truncate group-hover:text-stone-900">
                  {file.name}
                </p>
                {file.size && (
                  <p className="text-[10px] text-stone-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Status */}
      {effectiveId && (
        <div className="px-5 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span>{files.length} File</span>
          <span className="flex items-center gap-1.5 font-medium text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Terhubung
          </span>
        </div>
      )}
    </div>
  );
}
