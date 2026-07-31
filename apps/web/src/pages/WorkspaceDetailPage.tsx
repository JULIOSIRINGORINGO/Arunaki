import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  FileText,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  Send,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { FileUploadZone } from "../components/workspace/FileUploadZone";
import { ScheduledReportsPanel } from "../components/workspace/ScheduledReportsPanel";
import { API_BASE } from "../lib/api";

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

interface AgentLog {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState("");
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string[]>([]);
  const [approvalRequest, setApprovalRequest] = useState<{
    toolName: string;
    args: Record<string, any>;
    description: string;
  } | null>(null);
  const [agentArtifacts, setAgentArtifacts] = useState<any[]>([]);
  const [agentResultText, setAgentResultText] = useState("");

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

  const runWorkspaceAgent = async (overrideGoal?: string) => {
    const targetGoal = overrideGoal || goal;
    if (!targetGoal.trim() || !id || isAgentRunning) return;

    setIsAgentRunning(true);
    setAgentLogs([]);
    setAgentResultText("");
    setApprovalRequest(null);

    try {
      await fetchEventSource(`${API_BASE}/workspaces/${id}/agent/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: targetGoal,
        }),
        onmessage(msg) {
          if (!msg.data) return;
          try {
            const event = JSON.parse(msg.data);
            const time = new Date().toLocaleTimeString();

            if (event.type === "thinking") {
              setAgentLogs((prev) => [
                ...prev,
                { id: Date.now().toString(), type: "thinking", message: event.data, timestamp: time },
              ]);
            } else if (event.type === "plan_created") {
              setCurrentPlan(event.data.steps || []);
              setAgentLogs((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  type: "plan",
                  message: `Rencana otonom disusun (${event.data.steps?.length || 0} langkah)`,
                  timestamp: time,
                },
              ]);
            } else if (event.type === "tool_start") {
              setAgentLogs((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  type: "tool",
                  message: `Jalankan Tool: ${event.data.toolName}`,
                  timestamp: time,
                },
              ]);
            } else if (event.type === "approval_required") {
              setApprovalRequest(event.data);
              setAgentLogs((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  type: "approval",
                  message: `MEMBUTUHKAN PERSETUJUAN: ${event.data.description}`,
                  timestamp: time,
                },
              ]);
            } else if (event.type === "tool_done") {
              setAgentLogs((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  type: "tool_done",
                  message: `Tool ${event.data.toolName} selesai: ${event.data.result?.preview || "OK"}`,
                  timestamp: time,
                },
              ]);
            } else if (event.type === "text_delta") {
              setAgentResultText((prev) => prev + event.data);
            } else if (event.type === "done") {
              if (event.data?.artifacts) {
                setAgentArtifacts((prev) => [...prev, ...event.data.artifacts]);
              }
              if (event.data?.content) {
                setAgentResultText(event.data.content);
              }
              setAgentLogs((prev) => [
                ...prev,
                { id: Date.now().toString(), type: "done", message: "Pekerjaan otonom di Workspace selesai!", timestamp: time },
              ]);
            }
          } catch {
            // ignore JSON parse errors
          }
        },
        onerror(err) {
          console.error("Workspace agent stream error:", err);
          throw err; // stop fetch-event-source infinite retry
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAgentRunning(false);
      queryClient.invalidateQueries({ queryKey: ["files", id] });
    }
  };

  const handleApprove = async () => {
    if (!approvalRequest || !id) return;
    try {
      await fetch(`${API_BASE}/workspaces/${id}/agent/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      });
      setApprovalRequest(null);
    } catch (e) {
      console.error("Failed to approve:", e);
    }
  };

  const handleReject = async () => {
    if (!approvalRequest || !id) return;
    try {
      await fetch(`${API_BASE}/workspaces/${id}/agent/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: false }),
      });
      setApprovalRequest(null);
    } catch (e) {
      console.error("Failed to reject:", e);
    }
  };

  const files = filesData || [];

  return (
    <div className="flex h-full w-full bg-surface-50">
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

      {/* Center Panel - Autonomous Agent Workspace */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
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

        {/* Safety Approval Gate Alert Banner */}
        {approvalRequest && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between animate-fade-in z-20">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="text-amber-600 shrink-0" size={18} />
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  Izin Keamanan Diperlukan (Approval Gate)
                </p>
                <p className="text-[11px] text-amber-700">
                  {approvalRequest.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReject}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Tolak
              </button>
              <button
                onClick={handleApprove}
                className="px-3 py-1 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 shadow-2xs transition-colors cursor-pointer"
              >
                Izinkan & Lanjutkan
              </button>
            </div>
          </div>
        )}

        {/* Autonomous Progress Logs & Output View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentPlan.length > 0 && (
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                <Sparkles size={14} className="text-emerald-600" />
                <span>Rencana Eksekusi Otonom (Autonomous Plan)</span>
              </div>
              <ul className="space-y-1 text-xs text-emerald-700 pl-4 list-disc">
                {currentPlan.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {agentLogs.length > 0 && (
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-700 mb-2">Live Progress Log:</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[11px]">
                {agentLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-gray-600">
                    <span className="text-gray-400 shrink-0">[{log.timestamp}]</span>
                    <span className={log.type === "approval" ? "text-amber-600 font-bold" : ""}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agentResultText && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-gray-900 font-semibold text-sm border-b border-gray-100 pb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Hasil Analisis & Eksekusi Workspace Agent</span>
              </div>
              <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {agentResultText}
              </div>
            </div>
          )}

          {!isAgentRunning && agentLogs.length === 0 && (
            <div className="text-center py-16 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-surface-200 flex items-center justify-center mx-auto mb-3">
                <FolderOpen className="text-surface-400" size={24} />
              </div>
              <h3 className="text-sm font-semibold text-surface-800 mb-1">
                Autonomous Workspace Agent Siap
              </h3>
              <p className="text-xs text-surface-500 max-w-sm mx-auto">
                Ketik tujuan utama Anda di bawah. Agent akan membaca seluruh file di workspace, menyusun rencana, dan mengeksekusi pekerjaan secara otonom.
              </p>
            </div>
          )}
        </div>

        {/* Goal Input Prompt Bar */}
        <div className="px-5 py-3.5 border-t border-surface-200 bg-surface-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runWorkspaceAgent();
            }}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-2xs focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all"
          >
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Berikan tujuan otonom... (contoh: Analisis semua file dan rangkum di Excel)"
              disabled={isAgentRunning}
              className="flex-1 bg-transparent border-0 outline-none text-xs text-gray-900 placeholder:text-gray-400 py-1 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!goal.trim() || isAgentRunning}
              className="px-3.5 py-1.5 rounded-xl bg-black text-white hover:bg-gray-800 disabled:opacity-30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
            >
              {isAgentRunning ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Proses...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Jalankan</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Panel - Studio & Artifacts */}
      <div className="w-80 border-l border-surface-200 bg-surface-100 flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-surface-800">
            Studio / Output & Jadwal
          </h2>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
            Proactive Cron
          </span>
        </div>

        <div className="p-3.5 flex-1 overflow-y-auto space-y-4">
          <ScheduledReportsPanel workspaceId={id || ""} />

          <div className="border-t border-surface-200 pt-3">
            <h4 className="text-[11px] font-semibold text-surface-600 mb-2 uppercase tracking-wider">
              File Hasil / Artifacts ({agentArtifacts.length})
            </h4>
            {agentArtifacts.length === 0 ? (
              <p className="text-[11px] text-surface-500 text-center py-4">
                File hasil kerja agent / cron akan muncul di sini.
              </p>
            ) : (
            agentArtifacts.map((art) => (
              <div
                key={art.id}
                className="bg-white border border-surface-200 rounded-xl p-3 space-y-2 shadow-2xs hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                  <p className="text-xs font-semibold text-surface-800 truncate">
                    {art.filename}
                  </p>
                </div>
                <p className="text-[11px] text-surface-500 truncate">
                  {art.preview || "Hasil export workspace"}
                </p>
              </div>
            ))
          )}
          </div>
        </div>

        <div className="px-4 py-3.5 border-t border-surface-200">
          <h3 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2">
            Workspace Info
          </h3>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-surface-500">Files</span>
              <span className="text-surface-700 font-medium">{files.length}</span>
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
