/* Hallmark · macrostructure: Triple Panel · theme: Studio · accent: green */
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  FileText,
  RefreshCw,
  Upload,
  BarChart3,
  FileSpreadsheet,
  File,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { FileUploadZone } from "../components/workspace/FileUploadZone";

const API_BASE = "http://localhost:3000/api/v1";

const quickActions = [
  { icon: BarChart3, label: "Generate Report", desc: "Create production summary" },
  { icon: FileSpreadsheet, label: "Create Summary", desc: "Quick data overview" },
  { icon: File, label: "Export Data", desc: "Export workspace data" },
];

const fileTypeColors: Record<string, string> = {
  pdf: "text-error",
  xlsx: "text-accent",
  xls: "text-accent",
  csv: "text-accent",
  docx: "text-primary-400",
  doc: "text-primary-400",
  txt: "text-surface-500",
  md: "text-surface-500",
};

function getFileColor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return fileTypeColors[ext] || "text-surface-500";
}

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: workspace } = useQuery({
    queryKey: ["workspace", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/workspaces/${id}`);
      const data = await res.json();
      return data.data;
    },
    enabled: !!id,
  });

  const { data: filesData } = useQuery({
    queryKey: ["files", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/files/workspace/${id}`);
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!id,
  });

  const initWorkspace = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/workspaces/${id}/initialize`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", id] });
    },
  });

  const files = filesData || [];

  return (
    <div className="flex h-full">
      {/* Left Panel - Sources */}
      <div className="w-64 border-r border-surface-200 bg-surface-100 flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-surface-200">
          <div className="flex items-center gap-2 mb-2.5">
            <Link
              to="/workspace"
              className="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-colors"
            >
              <ArrowLeft size={14} />
            </Link>
            <h2 className="text-[13px] font-semibold text-surface-800">
              Sources
            </h2>
          </div>
          <FileUploadZone
            workspaceId={id!}
            onUploadComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["files", id] });
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-px">
          {files.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="mx-auto text-surface-400 mb-1.5" size={20} />
              <p className="text-[11px] text-surface-500">
                Belum ada file
              </p>
            </div>
          ) : (
            files.map((file: any) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-200 transition-colors cursor-pointer group"
              >
                <FileText size={12} className={`${getFileColor(file.name)} shrink-0`} />
                <span className="text-[12px] text-surface-600 truncate group-hover:text-surface-800">
                  {file.name}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-surface-200 bg-surface-100">
          <div className="flex items-center justify-between text-[11px] text-surface-500">
            <span>{files.length} files</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Indexed
            </span>
          </div>
        </div>
      </div>

      {/* Center Panel */}
      <div className="flex-1 flex flex-col bg-surface-50 min-w-0">
        <div className="px-5 py-3.5 bg-surface-100 border-b border-surface-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-surface-900">
                {workspace?.name || "Loading..."}
              </h1>
              <p className="text-[11px] text-surface-500 mt-0.5">
                Status:{" "}
                <span className="font-medium text-surface-600">
                  {workspace?.status || "unknown"}
                </span>
              </p>
            </div>
            <button
              onClick={() => initWorkspace.mutate()}
              disabled={initWorkspace.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface-100 rounded-lg hover:bg-accent-dim disabled:opacity-40 text-[13px] font-medium transition-all duration-150 active:scale-[0.98]"
            >
              <RefreshCw
                size={13}
                className={initWorkspace.isPending ? "animate-spin" : ""}
              />
              Initialize
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center animate-fade-in">
            <div className="w-14 h-14 rounded-xl bg-surface-200 flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="text-surface-400" size={24} />
            </div>
            <h3 className="text-[13px] font-semibold text-surface-700 mb-1">
              Workspace Content
            </h3>
            <p className="text-[11px] text-surface-500 max-w-xs">
              Konten workspace akan muncul di sini setelah initialization selesai.
            </p>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-surface-200 bg-surface-100">
          <div className="flex items-center gap-2.5 bg-surface-200 border border-surface-300 rounded-lg px-3 py-2.5">
            <span className="text-[13px] text-surface-500 flex-1">
              Minta AI untuk menganalisis workspace ini...
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel - Studio */}
      <div className="w-56 border-l border-surface-200 bg-surface-100 flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-surface-200">
          <h2 className="text-[13px] font-semibold text-surface-800">
            Studio
          </h2>
        </div>

        <div className="p-3.5">
          <h3 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">
            Quick Actions
          </h3>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-surface-200 transition-colors group"
              >
                <div className="w-7 h-7 rounded-md bg-surface-200 group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                  <action.icon size={13} className="text-surface-500 group-hover:text-accent transition-colors" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-surface-700">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-surface-500">
                    {action.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3.5 border-t border-surface-200 mt-auto">
          <h3 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">
            Workspace Info
          </h3>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-surface-500">Files</span>
              <span className="text-surface-700 font-medium">{files.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Language</span>
              <span className="text-surface-700 font-medium">ID</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Status</span>
              <span className="text-surface-700 font-medium capitalize">
                {workspace?.status || "unknown"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
