import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import Markdown from "react-markdown";
import {
  Settings,
  Info,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  ArrowUp,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Bot,
  Square,
  ChevronDown,
  ChevronRight,
  Brain,
  Edit3,
  Save,
  Minus,
  Maximize2,
  RotateCw,
  GripHorizontal,
  Move,
} from "lucide-react";
import { toast } from "sonner";
import FileTree from "../components/workspace/FileTree";
import { ArunakiLogo } from "../components/common/ArunakiLogo";
import { API_BASE, apiFetch } from "../lib/api";

interface AgentStep {
  type: "thinking" | "plan" | "tool" | "result" | "error";
  label: string;
  detail?: string;
  planList?: string[];
  status: "running" | "done" | "error";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  steps?: AgentStep[];
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  analysisResult?: string | null;
  steps?: AgentStep[];
}

const MessageAgentSteps = ({ steps }: { steps: AgentStep[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!steps || steps.length === 0) return null;
  const getStepIcon = (step: AgentStep) => {
    if (step.status === "running") return <Loader2 className="w-3.5 h-3.5 text-gray-500 shrink-0 animate-spin" />;
    if (step.status === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  };

  return (
    <div className="bg-white border border-gray-200/90 rounded-xl p-3 space-y-2 shadow-2xs mb-3 text-left">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 cursor-pointer text-left hover:opacity-85 transition-opacity min-w-0 flex-1 pr-1"
        >
          <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
            <Brain className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-900 truncate">
                Eksekusi Selesai
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                {steps.filter((s) => s.status === 'done').length}/{steps.length}
              </span>
            </div>
          </div>
          <div className="text-gray-400 shrink-0">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="pt-2 border-t border-gray-100 space-y-1.5 max-h-48 overflow-y-auto">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-[10px] p-1.5 rounded-lg hover:bg-gray-50`}
            >
              <div className="mt-0.5 shrink-0 bg-white rounded-full p-0.5 border border-gray-100">
                {getStepIcon(step)}
              </div>
              <div className="min-w-0 flex-1 break-words">
                <span className="font-medium text-gray-800">
                  {step.label}
                </span>
                {step.detail && (
                  <span className="text-gray-500 text-[9px] block mt-0.5 font-mono truncate">
                    {step.detail}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function WorkspacePage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [, setIsCreating] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectedWsRef = useRef<string | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);

  // Multi-Session Chat & Slash Command State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("session_default");

  // Agent auto-analysis state
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [activeToolAction, setActiveToolAction] = useState<{ toolName: string; args?: any } | null>(null);
  const [isStepsExpanded, setIsStepsExpanded] = useState(true);

  // Mirror of agentSteps for use inside SSE handlers (closure staleness).
  const agentStepsRef = useRef<AgentStep[]>([]);
  agentStepsRef.current = agentSteps;

  // VS Code-like: native folder tree from Electron IPC
  const [nativeTree, setNativeTree] = useState<any[] | null>(null);
  const [nativeFileCount, setNativeFileCount] = useState(0);
  const [connectedFolderPath, setConnectedFolderPath] = useState<string | null>(null);

  // Workspace Heartbeat & Proactive Monitor State (OpenClaw Layer 10 & 29)
  const [heartbeatAlert, setHeartbeatAlert] = useState<string | null>(null);
  const previousFileCountRef = useRef<number>(0);

  // VS Code Central Workspace File Editor & Floating Draggable Chat State
  const [openEditorFile, setOpenEditorFile] = useState<{
    path: string;
    name: string;
    content: string;
    isEditing?: boolean;
  } | null>(null);

  type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

  const [chatPosition, setChatPosition] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? Math.max(20, window.innerWidth - 600) : 400,
    y: 76,
  }));
  const [chatSize, setChatSize] = useState<{ width: number; height: number }>({ width: 540, height: 560 });

  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);

  const isDraggingChatRef = useRef(false);
  const isResizingChatRef = useRef(false);
  const resizeDirRef = useRef<ResizeDirection | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeStartRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startXPos: number; startYPos: number }>({
    startX: 0,
    startY: 0,
    startW: 540,
    startH: 560,
    startXPos: 260,
    startYPos: 70,
  });
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);
  // Direct DOM write during drag/resize — avoids re-rendering the whole
  // WorkspacePage tree on every mousemove frame (heavy: file tree, sessions).
  const chatPanelRef = useRef<HTMLDivElement | null>(null);

  const handleStartDragChat = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('form') ||
      target.closest('a') ||
      target.closest('[class*="cursor-n-"]') ||
      target.closest('[class*="cursor-s-"]') ||
      target.closest('[class*="cursor-w-"]') ||
      target.closest('[class*="cursor-e-"]') ||
      target.closest('[class*="cursor-ne-"]') ||
      target.closest('[class*="cursor-nw-"]') ||
      target.closest('[class*="cursor-se-"]') ||
      target.closest('[class*="cursor-sw-"]')
    ) {
      return;
    }
    if (window.getSelection() && window.getSelection()?.toString().length! > 0) {
      return;
    }
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingChatRef.current = true;
    setIsDraggingChat(true);
    dragOffsetRef.current = {
      x: e.clientX - chatPosition.x,
      y: e.clientY - chatPosition.y,
    };
  };



  const handleStartResizeChat = (dir: ResizeDirection, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingChatRef.current = true;
    resizeDirRef.current = dir;
    setIsResizingChat(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: chatSize.width,
      startH: chatSize.height,
      startXPos: chatPosition.x,
      startYPos: chatPosition.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingChatRef.current) {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const nextX = Math.max(10, Math.min(window.innerWidth - 120, e.clientX - dragOffsetRef.current.x));
          const nextY = Math.max(10, Math.min(window.innerHeight - 60, e.clientY - dragOffsetRef.current.y));
          const panel = chatPanelRef.current;
          if (panel) {
            panel.style.left = `${nextX}px`;
            panel.style.top = `${nextY}px`;
          } else {
            setChatPosition({ x: nextX, y: nextY });
          }
        });
      } else if (isResizingChatRef.current && resizeDirRef.current) {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const dir = resizeDirRef.current!;
          const deltaX = e.clientX - resizeStartRef.current.startX;
          const deltaY = e.clientY - resizeStartRef.current.startY;

          let newW = resizeStartRef.current.startW;
          let newH = resizeStartRef.current.startH;
          let newX = resizeStartRef.current.startXPos;
          let newY = resizeStartRef.current.startYPos;

          // East (Right)
          if (dir.includes('e')) {
            newW = Math.max(240, Math.min(window.innerWidth - newX - 10, resizeStartRef.current.startW + deltaX));
          }
          // West (Left)
          if (dir.includes('w')) {
            const rightEdge = resizeStartRef.current.startXPos + resizeStartRef.current.startW;
            const rawW = resizeStartRef.current.startW - deltaX;
            const clampedW = Math.max(240, Math.min(rightEdge - 10, rawW));
            newW = clampedW;
            newX = rightEdge - clampedW;
          }
          // South (Bottom)
          if (dir.includes('s')) {
            newH = Math.max(180, Math.min(window.innerHeight - newY - 10, resizeStartRef.current.startH + deltaY));
          }
          // North (Top)
          if (dir.includes('n')) {
            const bottomEdge = resizeStartRef.current.startYPos + resizeStartRef.current.startH;
            const rawH = resizeStartRef.current.startH - deltaY;
            const clampedH = Math.max(180, Math.min(bottomEdge - 10, rawH));
            newH = clampedH;
            newY = bottomEdge - clampedH;
          }

          const panel = chatPanelRef.current;
          if (panel) {
            panel.style.width = `${newW}px`;
            panel.style.height = `${newH}px`;
            panel.style.left = `${newX}px`;
            panel.style.top = `${newY}px`;
          } else {
            setChatSize({ width: newW, height: newH });
            setChatPosition({ x: newX, y: newY });
          }
        });
      }
    };

    const handleMouseUp = () => {
      if (isDraggingChatRef.current || isResizingChatRef.current) {
        isDraggingChatRef.current = false;
        isResizingChatRef.current = false;
        resizeDirRef.current = null;
        // Commit final position/size to React state so future drags and
        // renders (e.g. minimize toggle) use the updated values.
        const panel = chatPanelRef.current;
        if (panel) {
          setChatPosition({ x: panel.offsetLeft, y: panel.offsetTop });
          setChatSize({ width: panel.offsetWidth, height: panel.offsetHeight });
        }
        setIsDraggingChat(false);
        setIsResizingChat(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const handleOpenFileInEditor = (path: string, name: string, content?: string) => {
    setOpenEditorFile({
      path,
      name,
      content: content || "",
      isEditing: false,
    });
  };

  const handleSaveEditorContent = async () => {
    if (!openEditorFile) return;
    try {
      if ((window as any).arunakiDesktop?.writeFile) {
        const res = await (window as any).arunakiDesktop.writeFile(openEditorFile.path, openEditorFile.content);
        if (res?.error) {
          toast.error(`Gagal menyimpan file: ${res.error}`);
        } else {
          toast.success(`File "${openEditorFile.name}" berhasil disimpan!`);
          setOpenEditorFile({ ...openEditorFile, isEditing: false });
        }
      } else {
        toast.info("Penyimpanan file fisik memerlukan mode Desktop Electron.");
        setOpenEditorFile({ ...openEditorFile, isEditing: false });
      }
    } catch (err: any) {
      toast.error(`Gagal menyimpan file: ${err.message}`);
    }
  };

  // Session Persistence & Helpers
  useEffect(() => {
    if (!workspaceId) return;
    try {
      const stored = localStorage.getItem(`arunaki_sessions_${workspaceId}`);
      if (stored) {
        const parsed: ChatSession[] = JSON.parse(stored);
        if (parsed && parsed.length > 0) {
          setSessions(parsed);
          const lastActive = localStorage.getItem(`arunaki_active_session_${workspaceId}`);
          if (lastActive && parsed.some((s) => s.id === lastActive)) {
            setActiveSessionId(lastActive);
            const activeSess = parsed.find((s) => s.id === lastActive);
            if (activeSess?.analysisResult) {
              setAnalysisResult(activeSess.analysisResult);
            }
            setAgentSteps(activeSess?.steps || []);
          } else {
            setActiveSessionId(parsed[0].id);
          }
          return;
        }
      }
    } catch {
      // ignore parse error
    }

    // Default initial session
    const defaultSession: ChatSession = {
      id: "session_default",
      title: "Sesi Utama",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setSessions([defaultSession]);
    setActiveSessionId("session_default");
  }, [workspaceId]);

  const addMessageToActiveSession = useCallback((msg: ChatMessage, newAnalysisResult?: string | null, newSteps?: AgentStep[]) => {
    if (!workspaceId) return;
    setSessions((prevSessions) => {
      const updated = prevSessions.map((session) => {
        if (session.id === activeSessionId) {
          const updatedMessages = [...session.messages, msg];
          return {
            ...session,
            messages: updatedMessages,
            analysisResult: newAnalysisResult !== undefined ? newAnalysisResult : session.analysisResult,
            steps: newSteps !== undefined ? newSteps : session.steps,
            updatedAt: new Date().toISOString(),
          };
        }
        return session;
      });
      localStorage.setItem(`arunaki_sessions_${workspaceId}`, JSON.stringify(updated));
      return updated;
    });
  }, [activeSessionId, workspaceId]);

  const createNewSession = useCallback((customTitle?: string) => {
    if (!workspaceId) return;
    const newSessionId = `session_${Date.now()}`;
    const count = sessions.length + 1;
    const newSession: ChatSession = {
      id: newSessionId,
      title: customTitle || `Sesi Percakapan #${count}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setActiveSessionId(newSessionId);
    setAnalysisResult(null);
    setAgentSteps([]);
    localStorage.setItem(`arunaki_sessions_${workspaceId}`, JSON.stringify(updatedSessions));
    localStorage.setItem(`arunaki_active_session_${workspaceId}`, newSessionId);
    toast.success(`Sesi baru "${newSession.title}" dibuat!`);
  }, [sessions, workspaceId]);

  const switchSession = useCallback((sessionId: string) => {
    if (!workspaceId) return;
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    setActiveSessionId(sessionId);
    localStorage.setItem(`arunaki_active_session_${workspaceId}`, sessionId);
    setAnalysisResult(target.analysisResult || null);
    setAgentSteps(target.steps || []);
    toast.info(`Beralih ke "${target.title}"`);
  }, [sessions, workspaceId]);

  const deleteSession = useCallback((sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (sessions.length <= 1) {
      toast.error("Minimal harus ada 1 sesi percakapan.");
      return;
    }
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    if (workspaceId) {
      localStorage.setItem(`arunaki_sessions_${workspaceId}`, JSON.stringify(updated));
    }
    if (activeSessionId === sessionId) {
      const fallback = updated[0];
      setActiveSessionId(fallback.id);
      if (workspaceId) {
        localStorage.setItem(`arunaki_active_session_${workspaceId}`, fallback.id);
      }
    }
    toast.success("Sesi percakapan dihapus.");
  }, [activeSessionId, sessions, workspaceId]);

  // Restore last connected workspace on mount
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/workspaces`);
        const json = await res.json();
        const workspaces = json.data || [];

        // Find workspace with rootPath (connected folder)
        // Prefer the last-connected workspace, not just the newest.
        const storedId = localStorage.getItem('arunaki_workspace_id');
        const connected =
          (storedId && workspaces.find((ws: any) => ws.id === storedId && ws.rootPath)) ||
          workspaces.find((ws: any) => ws.rootPath) || null;

        if (connected && !cancelled) {
          setWorkspaceId(connected.id);
          setConnectedFolderPath(connected.rootPath);
          setIsConnected(true);
          connectedWsRef.current = connected.id;
          localStorage.setItem('arunaki_workspace_id', connected.id);
          queryClient.invalidateQueries({ queryKey: ["wsFiles", connected.id] });

          // Load cached analysis result (if available from previous session)
          try {
            const analysisRes = await apiFetch(`${API_BASE}/workspaces/${connected.id}/analysis`);
            const analysisJson = await analysisRes.json();
            if (analysisJson.data?.analysisResult && !cancelled) {
              setAnalysisResult(analysisJson.data.analysisResult);
              setAgentSteps([{
                type: "result",
                label: "Analisis sebelumnya dimuat dari cache",
                detail: `Terakhir dianalisis: ${new Date(analysisJson.data.analyzedAt).toLocaleString('id-ID')}`,
                status: "done",
              }]);
            }
          } catch {
            // No cached analysis — that's fine
          }

          setIsRestoring(false);

          // Load native tree in background (non-blocking)
          const desktop = (window as any).arunakiDesktop;
          if (desktop?.getFolderTree && connected.rootPath) {
            desktop.getFolderTree(connected.rootPath).then((scan: any) => {
              if (scan?.tree && !cancelled) {
                const countFiles = (nodes: any[]): number =>
                  nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
                setNativeTree(scan.tree);
                setNativeFileCount(countFiles(scan.tree));
              }
            }).catch(() => {});
          }
          return;
        }
      } catch {
        // Backend not available
      }
      if (!cancelled) setIsRestoring(false);
    };
    restore();
    return () => { cancelled = true; };
  }, [queryClient]);

  // No auto-popup modal — folder selection is done via the File menu button in the header

  const refreshFolderRef = useRef<(wsId: string) => void>(() => {});

  const triggerAutoAnalysis = useCallback(async (wsId: string, goal?: string) => {
    setIsAnalyzing(true);
    setAgentSteps([]);
    setAnalysisResult(null);

    const abortController = new AbortController();
    agentAbortRef.current = abortController;

    try {
      const activeSession = sessions.find((s) => s.id === activeSessionId);
      const historyMessages = (activeSession?.messages ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      await fetchEventSource(`${API_BASE}/workspaces/${wsId}/agent/stream`, {
        fetch: apiFetch,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          goal: goal || "Baca dan analisis semua dokumen dalam workspace ini. Buat ringkasan singkat isi setiap dokumen dan identifikasi poin-poin penting.",
          historyMessages,
        }),
        openWhenHidden: true,
        onmessage(ev) {
          try {
            const event = JSON.parse(ev.data);
            switch (event.type) {
              case "thinking":
                setAgentSteps((prev) => [
                  ...prev,
                  { type: "thinking", label: event.data, status: "running" },
                ]);
                break;
              case "plan_created":
                setAgentSteps((prev) =>
                  prev.map((s) =>
                    s.status === "running" ? { ...s, status: "done" as const } : s
                  )
                );
                {
                  const steps = event.data.steps || [];
                  const isMultiStep = steps.length > 1;
                  const label = isMultiStep
                    ? `Langkah Eksekusi: ${steps.length} Langkah`
                    : `Eksekusi: ${steps[0] || "Mengerjakan permintaan"}`;
                  setAgentSteps((prev) => [
                    ...prev,
                    {
                      type: "plan",
                      label,
                      detail: steps.join(" | "),
                      planList: steps,
                      status: "done",
                    },
                  ]);
                }
                break;
              case "tool_start": {
                setActiveToolAction({ toolName: event.data.toolName, args: event.data.args });
                const toolName = event.data.toolName;
                const targetName = event.data.args?.filename || event.data.args?.path || event.data.args?.query || "";
                
                // Auto-open file in central editor when AI edits it
                if (toolName === "write_workspace_file" && targetName) {
                  const content = event.data.args?.content || event.data.args?.code || "";
                  setOpenEditorFile({
                    path: targetName,
                    name: targetName.split(/[/\\]/).pop() || targetName,
                    content: content,
                    isEditing: false,
                  });
                }

                const friendlyLabel = targetName
                  ? `Menjalankan ${toolName} → ${targetName}`
                  : `Menjalankan ${toolName}`;
                setAgentSteps((prev) => [
                  ...prev,
                  {
                    type: "tool",
                    label: friendlyLabel,
                    detail: targetName,
                    status: "running",
                  },
                ]);
                break;
              }
              case "tool_done": {
                setActiveToolAction(null);
                const toolName = event.data?.toolName || "";
                const metaFilename = event.data?.result?.metadata?.filename;
                const preview = event.data?.result?.preview;
                // read/search tools return the file content as preview — never
                // put that into the timeline. Use a short action label instead.
                const isContentTool =
                  toolName.includes("read_workspace_file") ||
                  toolName.includes("search_workspace") ||
                  toolName.includes("document_reader");
                const doneLabel =
                  event.data?.result?.status === "success"
                    ? isContentTool
                      ? `Selesai: ${toolName}${metaFilename ? ` → ${metaFilename}` : ""}`
                      : preview || `Selesai: ${toolName}`
                    : `Gagal: ${toolName}`;
                const doneStatus = event.data?.result?.status === "success" ? ("done" as const) : ("error" as const);
                setAgentSteps((prev) => {
                  const idx = prev.map((s) => s.type).lastIndexOf("tool");
                  const lastTool = idx >= 0 ? prev[idx] : null;
                  if (lastTool && lastTool.status === "running") {
                    const updated = [...prev];
                    updated[idx] = { ...lastTool, label: doneLabel, status: doneStatus };
                    return updated;
                  }
                  return [
                    ...prev,
                    { type: "tool", label: doneLabel, status: doneStatus },
                  ];
                });
                refreshFolderRef.current(wsId);
                break;
              }
              case "text_delta":
                setAnalysisResult(event.data);
                break;
              case "done":
                setActiveToolAction(null);
                setIsAnalyzing(false);
                setAgentSteps((prev) =>
                  prev.map((s) =>
                    s.status === "running" ? { ...s, status: "done" as const } : s
                  )
                );
                const finalSteps = agentStepsRef.current.map((s) =>
                  s.status === "running" ? { ...s, status: "done" as const } : s
                );
                if (event.data?.content) {
                  setAnalysisResult(event.data.content);
                  const aiMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: event.data.content,
                    timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
                    steps: finalSteps,
                  };
                  addMessageToActiveSession(aiMsg, event.data.content, finalSteps);
                }
                refreshFolderRef.current(wsId);
                abortController.abort();
                break;
              case "error":
                setActiveToolAction(null);
                setIsAnalyzing(false);
                setAgentSteps((prev) => [
                  ...prev,
                  {
                    type: "error",
                    label: `Error: ${event.data?.message || "Unknown error"}`,
                    status: "error",
                  },
                ]);
                abortController.abort();
                break;
            }
          } catch {
            // skip parse errors
          }
        },
        onerror(err) {
          console.error("Agent stream error:", err);
          setIsAnalyzing(false);
          setActiveToolAction(null);
          abortController.abort();
          throw err;
        },
        onclose() {
          setIsAnalyzing(false);
          setActiveToolAction(null);
          abortController.abort();
        },
      });
    } catch (err) {
      console.error("Agent analysis failed:", err);
      setIsAnalyzing(false);
    } finally {
      agentAbortRef.current = null;
    }
  }, [addMessageToActiveSession, sessions, activeSessionId]);

  const doConnect = useCallback(async (files: File[], folderName: string, businessType: string = "generic") => {
    setIsCreating(true);
    try {
      // 1. Create workspace
      const wsRes = await apiFetch(`${API_BASE}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, businessType }),
      });
      const wsJson = await wsRes.json();
      const newId = wsJson.data?.id;
      if (!newId) {
        toast.error("Gagal membuat workspace");
        return;
      }

      // 2. Upload files (if any exist)
      if (files.length > 0) {
        const formData = new FormData();
        formData.append("workspaceId", newId);
        formData.append("sourceName", "Uploads");
        const relativePaths: string[] = [];
        files.forEach((f) => {
          formData.append("files", f);
          relativePaths.push(f.name);
        });
        formData.append("relativePaths", JSON.stringify(relativePaths));

        const uploadRes = await apiFetch(`${API_BASE}/files/upload`, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          console.warn("File upload failed, but workspace created");
        }
      }

      // 3. Connect
      setWorkspaceId(newId);
      setIsConnected(true);
      connectedWsRef.current = newId;
      localStorage.setItem('arunaki_workspace_id', newId);
      queryClient.invalidateQueries({ queryKey: ["wsFiles", newId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(`Workspace "${folderName}" terhubung!`);

      // 4. Auto-analyze di background (fire & forget)
      triggerAutoAnalysis(newId);
    } catch (err: any) {
      console.error("Connect failed:", err);
      toast.error(`Gagal menghubungkan: ${err.message || "Periksa apakah backend berjalan"}`);
    } finally {
      setIsCreating(false);
    }
  }, [queryClient, triggerAutoAnalysis]);

  const { data: workspacesList = [] } = useQuery<any[]>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/workspaces`);
      const json = await res.json();
      return json.data || [];
    },
  });

  const handleReconnectFolder = useCallback(async (ws: any) => {
    if (!ws?.rootPath) return;
    setWorkspaceId(ws.id);
    setIsConnected(true);
    connectedWsRef.current = ws.id;
    localStorage.setItem('arunaki_workspace_id', ws.id);
    await queryClient.invalidateQueries({ queryKey: ['wsFiles', ws.id] });
    toast.success(`Folder "${ws.name}" dibuka kembali`);
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.getFolderTree && ws.rootPath) {
      try {
        const scan = await desktop.getFolderTree(ws.rootPath);
        if (scan?.tree) {
          const countFiles = (nodes: any[]): number =>
            nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
          setNativeTree(scan.tree);
          setNativeFileCount(countFiles(scan.tree));
        }
      } catch {}
    }
  }, [queryClient]);


  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCreating(true);
    const folderName = files[0].webkitRelativePath?.split("/")[0] || "Workspace Baru";
    const fileList = Array.from(files).filter(
      (f) => !f.name.startsWith(".") && !f.webkitRelativePath.includes("node_modules/")
    ).slice(0, 100);

    await doConnect(fileList, folderName);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [doConnect]);

  // Auto-connect folder when navigated from File menu button with openFolder param
  const openFolderParam = searchParams.get("openFolder");
  const autoConnectTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!openFolderParam || autoConnectTriggeredRef.current === openFolderParam) return;
    autoConnectTriggeredRef.current = openFolderParam;

    // Clear the search param so it doesn't re-trigger
    setSearchParams({}, { replace: true });

    // Trigger the native folder connect flow with the pre-selected path
    const autoConnect = async () => {
      const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
      if (!desktop?.getFolderTree) return;

      const folderPath = openFolderParam;
      const folderName = folderPath.split(/[\\/]/).pop() || "Workspace";

      // Check if already connected to this folder
      const normalized = (p: string) => p.replace(/[\\/]+/g, "\\").toLowerCase().replace(/\\$/, "");
      const existing = workspacesList.find(
        (ws: any) => ws.rootPath && normalized(ws.rootPath) === normalized(folderPath)
      );
      if (existing) {
        toast.info(`Folder "${folderName}" sudah pernah dibuka — menyambungkan kembali`);
        await handleReconnectFolder(existing);
        return;
      }

      // New folder — run the full connect flow
      setIsCreating(true);
      toast.info(`Membaca struktur folder "${folderName}"...`);

      try {
        const scan = await desktop.getFolderTree(folderPath);
        if (!scan?.tree) {
          toast.error("Gagal membaca folder.");
          setIsCreating(false);
          return;
        }

        const countFiles = (nodes: any[]): number =>
          nodes.reduce((sum: number, n: any) => sum + (n.type === "directory" ? countFiles(n.children || []) : 1), 0);
        const fileCount = countFiles(scan.tree);

        const wsRes = await apiFetch(`${API_BASE}/workspaces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: folderName, rootPath: folderPath, businessType: "generic" }),
        });
        const wsJson = await wsRes.json();
        const newId = wsJson.data?.id;
        if (!newId) {
          toast.error("Gagal membuat workspace");
          setIsCreating(false);
          return;
        }

        const connectRes = await apiFetch(`${API_BASE}/workspaces/${newId}/connect-folder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderPath }),
        });
        const connectJson = await connectRes.json().catch(() => null);
        if (!connectRes.ok || !connectJson?.data) {
          throw new Error(connectJson?.error?.message || "Backend gagal mengindeks folder");
        }

        setNativeTree(scan.tree);
        setNativeFileCount(fileCount);
        setConnectedFolderPath(folderPath);
        setWorkspaceId(newId);
        setIsConnected(true);
        connectedWsRef.current = newId;
        localStorage.setItem("arunaki_workspace_id", newId);
        queryClient.invalidateQueries({ queryKey: ["wsFiles", newId] });
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        toast.success(`Folder "${folderName}" terhubung! (${fileCount} file)`);
        triggerAutoAnalysis(newId);
      } catch (err: any) {
        console.error("Auto-connect folder failed:", err);
        toast.error(`Gagal menghubungkan folder: ${err.message || "Periksa apakah backend berjalan"}`);
      } finally {
        setIsCreating(false);
      }
    };

    autoConnect();
  }, [openFolderParam, searchParams, setSearchParams, workspacesList, handleReconnectFolder, queryClient, triggerAutoAnalysis]);

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}`);
      const json = await res.json();
      return json.data;
    },
    enabled: !!workspaceId,
  });

  const { data: files = [] } = useQuery<any[]>({
    queryKey: ["wsFiles", workspaceId],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/files/workspace/${workspaceId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!workspaceId,
  });

  useEffect(() => {
    document.title = workspace?.name ? `${workspace.name} — Arunaki` : 'Arunaki';
  }, [workspace?.name]);

  const refreshFolderQuietly = useCallback(async (wsId: string) => {
    const rootPath = connectedFolderPath || workspace?.rootPath;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.getFolderTree && rootPath) {
      try {
        const scan = await desktop.getFolderTree(rootPath);
        if (scan?.tree) {
          setNativeTree(scan.tree);
          const countFiles = (nodes: any[]): number =>
            nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
          setNativeFileCount(countFiles(scan.tree));
        }
      } catch {
        // ignore
      }
    }
    queryClient.invalidateQueries({ queryKey: ["wsFiles", wsId] });
  }, [connectedFolderPath, workspace?.rootPath, queryClient]);

  useEffect(() => {
    refreshFolderRef.current = refreshFolderQuietly;
  }, [refreshFolderQuietly]);

  const handleRefreshFolder = useCallback(async () => {
    if (workspaceId) {
      await refreshFolderQuietly(workspaceId);
    }
    toast.success("Struktur folder diperbarui!");
  }, [refreshFolderQuietly, workspaceId]);

  const handleCreateFile = useCallback(async (fileName: string) => {
    const rootPath = connectedFolderPath || workspace?.rootPath;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.writeFile && rootPath) {
      const filePath = `${rootPath}/${fileName}`.replace(/\\/g, '/');
      const res = await desktop.writeFile(filePath, '');
      if (res?.error) {
        toast.error(`Gagal membuat file: ${res.error}`);
      } else {
        toast.success(`File "${fileName}" berhasil dibuat!`);
        handleRefreshFolder();
      }
    } else {
      toast.info("Pembuatan file via Explorer membutuhkan Desktop Electron.");
    }
  }, [connectedFolderPath, workspace?.rootPath, handleRefreshFolder]);

  const handleCreateFolder = useCallback(async (folderName: string) => {
    const rootPath = connectedFolderPath || workspace?.rootPath;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.createFolder && rootPath) {
      const folderPath = `${rootPath}/${folderName}`.replace(/\\/g, '/');
      const res = await desktop.createFolder(folderPath);
      if (res?.error) {
        toast.error(`Gagal membuat folder: ${res.error}`);
      } else {
        toast.success(`Folder "${folderName}" berhasil dibuat!`);
        handleRefreshFolder();
      }
    } else {
      toast.info("Pembuatan folder via Explorer membutuhkan Desktop Electron.");
    }
  }, [connectedFolderPath, workspace?.rootPath, handleRefreshFolder]);

  const handleDeletePath = useCallback(async (targetPath: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus "${name}"?`)) return;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.deletePath) {
      const res = await desktop.deletePath(targetPath);
      if (res?.error) {
        toast.error(`Gagal menghapus: ${res.error}`);
      } else {
        toast.success(`"${name}" telah dihapus.`);
        handleRefreshFolder();
      }
    }
  }, [handleRefreshFolder]);

  const handleRenamePath = useCallback(async (oldPath: string, oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.renamePath) {
      const parts = oldPath.replace(/\\/g, '/').split('/');
      parts[parts.length - 1] = newName;
      const newPath = parts.join('/');

      const res = await desktop.renamePath(oldPath, newPath);
      if (res?.error) {
        toast.error(`Gagal mengubah nama: ${res.error}`);
      } else {
        toast.success(`Nama berhasil diubah dari "${oldName}" menjadi "${newName}"!`);
        handleRefreshFolder();
      }
    } else {
      toast.info("Pengubahan nama file/folder via Explorer membutuhkan Desktop Electron.");
    }
  }, [handleRefreshFolder]);

  const handleAnalyzeFile = useCallback((fileName: string) => {
    if (!workspaceId || isAnalyzing) return;
    const goal = `Baca dan analisis file "${fileName}" secara mendalam. Ekstrak data penting, identifikasi informasi utama, dan berikan ringkasan komprehensif.`;
    triggerAutoAnalysis(workspaceId, goal);
  }, [workspaceId, isAnalyzing, triggerAutoAnalysis]);

  const handleAbortAgent = useCallback(async () => {
    if (!workspaceId) return;
    agentAbortRef.current?.abort();
    agentAbortRef.current = null;
    try {
      await apiFetch(`${API_BASE}/workspaces/${workspaceId}/agent/abort`, { method: "POST" });
      toast.info("Permintaan pembatalan analisis dikirim.");
    } catch {
      toast.error("Gagal membatalkan agen.");
    }
    setIsAnalyzing(false);
  }, [workspaceId]);

  const handleSteerAgent = useCallback(async (steerText: string) => {
    if (!workspaceId || !steerText.trim() || !isAnalyzing) return;
    const steerMessage = steerText.trim();
    try {
      const res = await apiFetch(`${API_BASE}/agent/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, steerMessage }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`🎯 Mid-Run Steering terkirim: "${steerMessage}"`);
        setAgentSteps((prev) => [
          ...prev,
          {
            type: "thinking",
            label: `🎯 Mid-Run Steering dari Pengguna: "${steerMessage}"`,
            detail: "Agen otonom menerima instruksi tambahan pertengahan alur",
            status: "done",
          },
        ]);
      } else {
        toast.error(`Gagal mengirim steering: ${json.message}`);
      }
    } catch (err: any) {
      toast.error(`Gagal mengirim steering: ${err.message}`);
    }
  }, [workspaceId, isAnalyzing]);

  const executeSlashCommand = useCallback((command: string) => {
    const lower = command.toLowerCase().trim();
    if (lower === "/session new" || lower === "/new") {
      createNewSession();
      return;
    }
    if (lower === "/clear") {
      setSessions((prev) => {
        const updated = prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [] } : s));
        if (workspaceId) localStorage.setItem(`arunaki_sessions_${workspaceId}`, JSON.stringify(updated));
        return updated;
      });
        toast.info("Riwayat pesan di sesi ini dibersihkan.");
      return;
    }
  }, [activeSessionId, createNewSession, workspaceId]);

  const handleSlashCommand = useCallback((command: string) => {
    executeSlashCommand(command);
  }, [executeSlashCommand]);

  const handleSendChat = useCallback(async (inputText: string) => {
    if (!isConnected || !workspaceId || !inputText.trim() || isAnalyzing) return;
    const input = inputText.trim();

    // Handle slash commands
    if (input.startsWith("/")) {
      executeSlashCommand(input);
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    addMessageToActiveSession(userMsg);

    const activeSession = sessions.find((s) => s.id === activeSessionId);
    if (activeSession && activeSession.messages.length === 0) {
      const shortTitle = input.length > 25 ? input.substring(0, 25) + "..." : input;
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, title: shortTitle } : s))
      );
    }


    await triggerAutoAnalysis(workspaceId, input);
  }, [activeSessionId, addMessageToActiveSession, createNewSession, isAnalyzing, isConnected, sessions, triggerAutoAnalysis, workspaceId]);

  // Periodic Workspace Heartbeat & Background Monitor (Layer 10 & 29 OpenClaw)
  useEffect(() => {
    if (!isConnected || !workspaceId) return;

    const interval = setInterval(async () => {
      const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
      const rootPath = connectedFolderPath || workspace?.rootPath;

      if (desktop?.getFolderTree && rootPath) {
        try {
          const scan = await desktop.getFolderTree(rootPath);
          if (scan?.tree) {
            const countFiles = (nodes: any[]): number =>
              nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
            const currentCount = countFiles(scan.tree);

            if (previousFileCountRef.current > 0 && currentCount > previousFileCountRef.current) {
              const diff = currentCount - previousFileCountRef.current;
              toast.info(`📁 Heartbeat Monitor: Terdeteksi ${diff} file baru di Workspace!`);
              setNativeTree(scan.tree);
              setNativeFileCount(currentCount);
              setHeartbeatAlert(`Heartbeat Monitor: Terdeteksi ${diff} file baru di Workspace. Klik untuk memicu pemindaian ingatan AI.`);
            }
            previousFileCountRef.current = currentCount;
          }
        } catch {
          // desktop IPC can fail (app closed); heartbeat keeps running
        }
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [isConnected, workspaceId, connectedFolderPath, workspace?.rootPath]);

  // Active Session helper
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];


  // Use native file count from Electron tree if available, else from API
  const fileCount = nativeTree ? nativeFileCount : files.length;

  const getStepIcon = (step: AgentStep) => {
    if (step.status === "running") return <Loader2 className="w-3.5 h-3.5 text-gray-500 shrink-0 animate-spin" />;
    if (step.status === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  };

  if (isRestoring) {
    return (
      <div className="flex-1 h-full bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Memuat workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden h-full bg-transparent flex flex-col relative min-w-0">
      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Column - Clean Workspace Canvas / VS Code Central Editor */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
          {openEditorFile ? (
            /* VS CODE CENTER WORKSPACE EDITOR (Clean White Card with Black Header Capsule) */
            <div className="flex-1 flex flex-col bg-white text-gray-900 rounded-[24px] border border-stone-800/10 shadow-sm overflow-hidden h-full animate-fade-in">
              {/* Editor Black Header Capsule Toolbar */}
              <div className="flex items-center justify-between px-5 h-11 min-h-[44px] bg-[#1A191B] border-b border-stone-800/40 text-white shrink-0 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[#FF5E38] shrink-0" />
                  <span className="font-semibold text-xs text-white truncate">{openEditorFile.name}</span>
                  <span className="text-[11px] text-stone-400 font-mono truncate hidden sm:inline">{openEditorFile.path}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!openEditorFile.isEditing ? (
                    <button
                      type="button"
                      onClick={() => setOpenEditorFile((prev) => (prev ? { ...prev, isEditing: true } : null))}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-white rounded-lg font-semibold transition-colors cursor-pointer border border-stone-700/50"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#FF5E38]" />
                      <span>Edit Content</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveEditorContent}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs bg-[#FF5E38] hover:bg-[#ff4d24] text-[#1A191B] rounded-lg font-bold transition-colors shadow-2xs cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenEditorFile(null)}
                    className="p-1 hover:bg-stone-800 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Tutup Editor File"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Editor Text Content */}
              <div className="flex-1 p-5 font-mono text-xs overflow-auto bg-white text-gray-900 min-h-0 leading-relaxed">
                {openEditorFile.isEditing ? (
                  <textarea
                    value={openEditorFile.content}
                    onChange={(e) => setOpenEditorFile((prev) => (prev ? { ...prev, content: e.target.value } : null))}
                    className="w-full h-full bg-transparent text-gray-900 resize-none outline-none font-mono text-xs leading-relaxed"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-900">
                    {openEditorFile.content || "(File ini kosong)"}
                  </pre>
                )}
              </div>

              {/* Editor Footer */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-600 flex items-center justify-between font-mono shrink-0">
                <span>{openEditorFile.isEditing ? "Mode Sunting (Aktif)" : "Mode Pratinjau Terbuka (Read-Only)"}</span>
                <button
                  type="button"
                  onClick={() => setOpenEditorFile(null)}
                  className="hover:text-gray-900 text-[#FF5E38] font-semibold underline cursor-pointer"
                >
                  Tutup Editor File
                </button>
              </div>
            </div>
          ) : (
            /* CLEAN SPACIOUS WORKSPACE CANVAS (With Black Header Capsule Bar) */
            <div className="bg-white rounded-[24px] border border-stone-800/10 shadow-sm flex-1 h-full flex flex-col overflow-hidden min-w-0">
              {/* Canvas Black Header Toolbar */}
              <div className="flex items-center justify-between px-5 h-11 min-h-[44px] bg-[#1A191B] shrink-0 border-b border-stone-800/40 select-none">
                <span className="text-[#F4EFE6] font-bold text-xs tracking-wide">
                  Editor Dokumen
                </span>
              </div>

              <div className="flex-1 bg-white flex flex-col items-center justify-center gap-3 min-h-0 select-none animate-fade-in p-6">
                {/* Line 1: Icon */}
                <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#FF5E38] shadow-2xs mb-1">
                  <ArunakiLogo className="w-8 h-8" fill="#FF5E38" />
                </div>

                {/* Line 2 & 3: Big bold text lines */}
                <div className="text-center leading-none space-y-1">
                  <h1 className="text-3xl sm:text-4xl font-black text-stone-300 tracking-widest uppercase block">
                    ARUNAKI
                  </h1>
                  <h1 className="text-3xl sm:text-4xl font-black text-stone-300 tracking-widest uppercase block">
                    WORKSPACE
                  </h1>
                </div>
              </div>


            </div>
          )}
        </div>

        {/* Right Sidebar - Focused File Tree Explorer */}
        <div className="lg:col-span-4 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col">
            {!isConnected ? (
              <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
                <h3 className="font-bold text-sm sm:text-base text-gray-900 mb-2">Struktur Folder</h3>
                <p className="text-xs text-gray-500">Hubungkan folder untuk melihat struktur direktori.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 h-full">
                <FileTree
                  files={files.map((f: any) => ({ id: f.id, name: f.name, type: f.type, size: f.size }))}
                  workspaceName={workspace?.name || "Workspace"}
                  workspaceFolderPath={connectedFolderPath || workspace?.rootPath}
                  nativeTree={nativeTree ?? undefined}
                  onFileClick={handleOpenFileInEditor}
                  onRefresh={handleRefreshFolder}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onDeletePath={handleDeletePath}
                  onRenamePath={handleRenamePath}
                  onAnalyzeFile={handleAnalyzeFile}
                  activeAgentAction={activeToolAction}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for browser fallback folder selection */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-expect-error directory & webkitdirectory not in React types
        directory=""
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* POPUP MODAL: Kelola Workspace */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-2xl w-full max-w-lg p-6 sm:p-8 flex flex-col relative space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-900">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Kelola Workspace</h3>
                  <p className="text-xs text-gray-500">{workspace?.name || "Workspace Strategis & Analisis"}</p>
                </div>
              </div>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ringkasan Direktori Dokumen */}
            <div className="bg-[#F8F9FA] rounded-2xl border border-gray-100 p-5 space-y-2">
              <h4 className="font-bold text-sm text-gray-900">Ringkasan Direktori Dokumen</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                {!isConnected
                  ? "Belum ada dokumen yang terhubung. Klik tombol Hubungkan Folder untuk mengaktifkan ringkasan dan ekstraksi data otomatis."
                  : isAnalyzing
                  ? `AI sedang membaca ${fileCount} file dari "${workspace?.name}"...`
                  : analysisResult
                  ? `AI telah selesai menganalisis ${fileCount} file dari "${workspace?.name}".`
                  : `Workspace "${workspace?.name}" memiliki ${fileCount} file yang siap dianalisis oleh AI.`}
              </p>
            </div>

            {/* Log Aktivitas Terakhir */}
            <div className="bg-[#F8F9FA] rounded-2xl border border-gray-100 p-5 space-y-3">
              <h4 className="font-bold text-sm text-gray-900">Log Aktivitas Terakhir</h4>
              <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
                {!isConnected ? (
                  <div className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                      <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate font-medium">Workspace siap untuk pengindeksan awal</span>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 ml-2 font-mono">-</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate font-medium">Folder sedang dibuka...</span>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 ml-2 font-mono">-</span>
                  </div>
                ) : (
                  files.map((file: any) => {
                    const ext = file.name.split(".").pop()?.toLowerCase() || "";
                    const Icon = ["xlsx", "xls", "csv"].includes(ext)
                      ? FileSpreadsheet
                      : ["docx", "doc"].includes(ext)
                      ? FileText
                      : ShieldCheck;
                    const iconColor = ["docx", "doc"].includes(ext) ? "text-blue-600" : "text-gray-400";
                    return (
                      <div key={file.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                          <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
                          <span className="truncate font-medium">{file.name}</span>
                        </div>
                        <span className="text-[11px] text-emerald-600 font-mono shrink-0 ml-2">terbuka</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 bg-black text-white hover:bg-gray-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Viewport Overlay (Decoupled from page grid flow) */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {isChatMinimized ? (
          <div
            onClick={() => setIsChatMinimized(false)}
            style={{ right: "28px", top: "25px" }}
            className="pointer-events-auto fixed bg-[#FF5E38] hover:bg-[#ff4d24] text-white rounded-full px-3.5 py-1.5 shadow-md flex items-center gap-2.5 cursor-pointer select-none border border-[#FF5E38]/80 transition-all z-50 active:scale-95 font-semibold"
            title="Buka Asisten Intelijen Arunaki AI"
          >
            <Bot className="w-3.5 h-3.5 text-white shrink-0" />
            {isConnected && (
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-mono font-bold border border-white/30 shrink-0">
                {fileCount} Dokumen
              </span>
            )}
            <div
              className="p-1 hover:bg-white/15 text-white rounded-full transition-colors cursor-pointer shrink-0 ml-0.5"
              title="Buka Jendela Chat"
            >
              <Maximize2 className="w-3 h-3 text-white" />
            </div>
          </div>

        ) : (
          <div
            ref={chatPanelRef}
            onMouseDown={handleStartDragChat}
            style={{
              left: `${chatPosition.x}px`,
              top: `${chatPosition.y}px`,
              width: `${chatSize.width}px`,
              height: `${chatSize.height}px`,
            }}
            className={`pointer-events-auto absolute bg-white border border-gray-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-none ${
              isDraggingChat || isResizingChat ? "select-none shadow-amber-500/20" : ""
            }`}
          >
            {/* Drag Handle Header */}
            <div
              onMouseDown={handleStartDragChat}
              className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between cursor-move select-none shrink-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Move className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <Bot className="w-4 h-4 text-[#FF5E38] shrink-0" />
                {isConnected && (
                  <span className="text-[10px] bg-[#FF5E38]/20 text-[#FF5E38] px-2 py-0.5 rounded-full font-mono border border-[#FF5E38]/40 shrink-0 font-bold">
                    {fileCount} Dokumen
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setChatPosition({
                      x: Math.max(20, window.innerWidth - 600),
                      y: 76,
                    });
                    setChatSize({ width: 540, height: 560 });
                    setIsChatExpanded(false);
                    toast.success("Posisi & ukuran chat telah di-reset ke standar di bawah tombol :chat.");
                  }}

                  className="p-1 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-colors cursor-pointer"
                  title="Reset Posisi & Ukuran Chat ke Standar"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isChatExpanded) {
                      setChatSize({ width: 540, height: 560 });
                      setIsChatExpanded(false);
                    } else {
                      setChatSize({
                        width: Math.min(680, window.innerWidth - 60),
                        height: Math.min(580, window.innerHeight - 80),
                      });
                      setIsChatExpanded(true);
                    }
                  }}
                  className="p-1 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-colors cursor-pointer"
                  title={isChatExpanded ? "Ukuran Standar" : "Besarkan Chat"}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsChatMinimized(true)}
                  className="p-1 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-colors cursor-pointer"
                  title="Sembunyikan Chat (Minimize)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Chat Messages Timeline (Drag supported on empty background areas) */}
            <div
              onMouseDown={handleStartDragChat}
              className="p-3.5 overflow-y-auto flex-1 space-y-3 text-xs bg-gray-50/40 min-h-0"
            >
              {activeSession?.messages && activeSession.messages.length > 0 ? (
                activeSession.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-1 ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium px-1">
                      <span>{msg.role === "user" ? "Anda" : "Arunaki AI"}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div
                      className={`rounded-2xl p-3 text-xs shadow-2xs max-w-[90%] break-words ${
                        msg.role === "user"
                          ? "bg-gray-900 text-white font-medium rounded-tr-2xs"
                          : "bg-white text-gray-800 border border-gray-200/90 rounded-tl-2xs space-y-2"
                      }`}
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {msg.role === "user" ? (
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="w-full">
                          {msg.steps && msg.steps.length > 0 && <MessageAgentSteps steps={msg.steps} />}
                          <Markdown
                            components={{
                              strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                              p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-2">{children}</ol>,
                              ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-2">{children}</ul>,
                              li: ({ children }) => <li className="text-gray-800 leading-relaxed">{children}</li>,
                            }}
                          >
                            {msg.content}
                          </Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 space-y-2">
                  <Bot className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs">Ketik pertanyaan di bawah untuk berdiskusi dengan Arunaki AI.</p>
                </div>
              )}

              {/* Proactive Heartbeat Alert Banner */}
              {heartbeatAlert && (
                <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3 flex items-center justify-between gap-2 text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Activity className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                    <span className="font-medium truncate text-[11px]">{heartbeatAlert}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHeartbeatAlert(null);
                      if (workspaceId && !isAnalyzing) triggerAutoAnalysis(workspaceId, "Lakukan pemindaian cepat dokumen baru.");
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-[10px] shrink-0 cursor-pointer"
                  >
                    Pindai Dokumen
                  </button>
                </div>
              )}

              {/* Live Visual AI Agent Action Banner */}
              {activeToolAction && isAnalyzing && (
                <div className="bg-gradient-to-r from-gray-900 to-amber-950 text-white rounded-xl p-3 border border-amber-500/30 shadow-md flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
                    <p className="text-[11px] font-mono text-gray-200 truncate">
                      {activeToolAction?.toolName === 'write_workspace_file'
                        ? `✏️ Menyunting "${activeToolAction?.args?.filename || 'dokumen'}"...`
                        : activeToolAction?.toolName === 'read_workspace_file'
                        ? `📖 Membaca "${activeToolAction?.args?.filename || 'dokumen'}"...`
                        : `🤖 Menjalankan ${activeToolAction?.toolName || 'tool'}...`}
                    </p>
                  </div>
                </div>
              )}

              {/* Agent Progress & Thinking Drawer (Global / Active Only) */}
              {isAnalyzing && agentSteps.length > 0 && (
                <div className="bg-white border border-gray-200/90 rounded-xl p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsStepsExpanded((prev) => !prev)}
                      className="flex items-center gap-2 cursor-pointer text-left hover:opacity-85 transition-opacity min-w-0 flex-1 pr-1"
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
                        {isAnalyzing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                        ) : (
                          <Brain className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {isAnalyzing ? "Proses Eksekusi Agen AI" : "Eksekusi Selesai"}
                          </span>
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                            {agentSteps.filter((s) => s.status === 'done').length}/{agentSteps.length}
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-400 shrink-0">
                        {isStepsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {isAnalyzing && (
                      <button
                        type="button"
                        onClick={handleAbortAgent}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 font-semibold cursor-pointer shrink-0 ml-1"
                      >
                        <Square className="w-2.5 h-2.5 text-red-600 fill-red-600" />
                        <span>Hentikan</span>
                      </button>
                    )}
                  </div>

                  {/* Expandable Step List Timeline */}
                  {isStepsExpanded && (
                    <div className="pt-2 border-t border-gray-100 space-y-1.5 max-h-48 overflow-y-auto">
                      {agentSteps.map((step, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2 text-[11px] p-1.5 rounded-lg ${
                            step.status === 'running' ? 'bg-amber-50/80 border border-amber-200/60' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0 bg-white rounded-full p-0.5 border border-gray-100">
                            {getStepIcon(step)}
                          </div>
                          <div className="min-w-0 flex-1 break-words">
                            <span className={`font-medium ${step.status === 'running' ? 'text-amber-900 font-semibold' : 'text-gray-800'}`}>
                              {step.label}
                            </span>
                            {step.detail && (
                              <span className="text-gray-500 text-[10px] block mt-0.5 font-mono truncate">
                                {step.detail}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Analysis Result */}
              {analysisResult && (
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-800 space-y-1.5 shadow-2xs">
                  <p className="font-bold text-gray-900 text-xs">Hasil Analisis AI</p>
                  <div className="text-gray-700 leading-relaxed text-[11px]" style={{ overflowWrap: 'anywhere' }}>
                    <Markdown>{analysisResult}</Markdown>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Prompt Input Bar */}
            <div className="p-3 sm:p-3.5 pr-7 border-t border-gray-100 bg-white relative shrink-0">
              <ChatInputForm
                onSend={handleSendChat}
                onSteer={handleSteerAgent}
                isAnalyzing={isAnalyzing}
                isConnected={isConnected}
                onSlashCommand={handleSlashCommand}
                files={files}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onNewSession={createNewSession}
                onSwitchSession={switchSession}
                onDeleteSession={deleteSession}
              />
            </div>

            {/* 8-Directional Edge & Corner Resize Handles */}
            <div
              onMouseDown={(e) => handleStartResizeChat('n', e)}
              className="absolute top-0 left-3 right-3 h-2 cursor-n-resize z-50 hover:bg-amber-400/30 transition-colors"
              title="Tarik Atas (Resize Height)"
            />
            <div
              onMouseDown={(e) => handleStartResizeChat('s', e)}
              className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize z-50 hover:bg-amber-400/30 transition-colors"
              title="Tarik Bawah (Resize Height)"
            />
            <div
              onMouseDown={(e) => handleStartResizeChat('w', e)}
              className="absolute top-3 bottom-3 left-0 w-2 cursor-w-resize z-50 hover:bg-amber-400/30 transition-colors"
              title="Tarik Kiri (Resize Width)"
            />
            <div
              onMouseDown={(e) => handleStartResizeChat('e', e)}
              className="absolute top-3 bottom-3 right-0 w-2 cursor-e-resize z-50 hover:bg-amber-400/30 transition-colors"
              title="Tarik Kanan (Resize Width)"
            />
            <div
              onMouseDown={(e) => handleStartResizeChat('nw', e)}
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50 hover:bg-amber-400/50 rounded-tl-2xl transition-colors"
              title="Tarik Sudut Kiri Atas"
            />
            <div
              onMouseDown={(e) => handleStartResizeChat('ne', e)}
              className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50 hover:bg-amber-400/50 rounded-tr-2xl transition-colors"
              title="Tarik Sudut Kanan Atas"
            />
            <div
              onMouseDown={(e) => handleStartResizeChat('sw', e)}
              className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50 hover:bg-amber-400/50 rounded-bl-2xl transition-colors"
              title="Tarik Sudut Kiri Bawah"
            />
            <div
              onMouseDown={(e) => handleStartResizeChat('se', e)}
              className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize flex items-center justify-center text-gray-400 hover:text-gray-900 z-50 select-none group"
              title="Tarik Sudut Kanan Bawah"
            >
              <GripHorizontal className="w-3 h-3 text-gray-400 group-hover:text-gray-900 transition-colors rotate-45" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatInputFormProps {
  onSend: (text: string) => void;
  onSteer: (text: string) => void;
  isAnalyzing: boolean;
  isConnected: boolean;
  onSlashCommand: (command: string) => void;
  files: { name: string }[];
  sessions: { id: string; title: string }[];
  activeSessionId: string;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string, e?: React.MouseEvent) => void;
}

const ChatInputForm = memo(function ChatInputForm({
  onSend,
  onSteer,
  isAnalyzing,
  isConnected,
  onSlashCommand,
  files,
  sessions,
  activeSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: ChatInputFormProps) {
  const [localInput, setLocalInput] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
    }
  }, [localInput]);

  const SLASH_COMMANDS = [
    { command: "/session new", label: "+ Buat Sesi Percakapan Baru" },
    { command: "/new", label: "+ Buat Sesi Baru (singkatan)" },
    { command: "/clear", label: "✕ Bersihkan Riwayat Pesan Sesi Ini" },
  ];

  // Filter files by the text after the last "@".
  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const names = files.map((f) => f.name).filter((n) => n.toLowerCase().includes(q));
    return names.slice(0, 12);
  }, [mentionQuery, files]);

  // Reset selection index when results change.
  useEffect(() => setMentionIndex(0), [mentionResults.length, mentionQuery]);

  const handleChange = (value: string) => {
    setLocalInput(value);
    // Slash command detection: input starts with "/" and has no space yet.
    if (value.startsWith("/") && !value.includes(" ")) {
      setSlashQuery(value.slice(1).toLowerCase());
      setMentionQuery(null);
    } else {
      setSlashQuery(null);
    }
    const atIndex = value.lastIndexOf("@");
    if (atIndex !== -1 && atIndex === value.length - 1) {
      setMentionQuery("");
    } else if (atIndex !== -1) {
      const query = value.slice(atIndex + 1);
      // Only trigger mention when no whitespace/other symbol follows @.
      if (/^[\w.\- ]*$/.test(query)) {
        setMentionQuery(query);
        return;
      }
      setMentionQuery(null);
    } else {
      setMentionQuery(null);
    }
  };

  const slashResults = useMemo(() => {
    if (slashQuery === null) return [];
    return SLASH_COMMANDS.filter((c) => c.command.toLowerCase().includes(`/${slashQuery}`));
  }, [slashQuery]);

  // Reset slash selection index when results change.
  useEffect(() => setSlashIndex(0), [slashResults.length, slashQuery]);

  const runSlashCommand = (command: string) => {
    onSlashCommand(command);
    setLocalInput("");
    setSlashQuery(null);
    setMentionQuery(null);
  };

  const insertMention = (fileName: string) => {
    if (mentionQuery === null) return;
    const atIndex = localInput.lastIndexOf("@");
    const before = localInput.slice(0, atIndex);
    const next = `${before}@${fileName} `;
    setLocalInput(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const len = next.length;
      inputRef.current?.setSelectionRange(len, len);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command navigation takes priority when the slash popup is open.
    if (slashQuery !== null && slashResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashResults.length) % slashResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        runSlashCommand(slashResults[slashIndex].command);
        return;
      }
      if (e.key === "Escape") {
        setSlashQuery(null);
        return;
      }
    }
    
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
      } else if (e.key === "Escape") {
        setMentionQuery(null);
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;
    if (isAnalyzing) {
      onSteer(localInput);
    } else {
      onSend(localInput);
    }
    setLocalInput("");
    setMentionQuery(null);
    setSlashQuery(null);
  };

  return (
    <div className="relative">
      {/* Slash Command Popup */}
      {slashQuery !== null && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
            Perintah Slash
          </div>
          {slashResults.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-gray-400">Tidak ada perintah yang cocok</div>
          ) : (
            <div className="max-h-44 overflow-y-auto">
              {slashResults.map((cmd, i) => (
                <button
                  key={cmd.command}
                  type="button"
                  onMouseEnter={() => setSlashIndex(i)}
                  onClick={() => runSlashCommand(cmd.command)}
                  className={`w-full text-left px-3 py-2 text-[11px] font-medium truncate cursor-pointer transition-colors ${
                    i === slashIndex ? "bg-amber-50 text-amber-900" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-mono text-amber-700">{cmd.command}</span>
                  <span className="ml-2 text-gray-500">{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sessions list */}
          <div className="border-t border-gray-100">
            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-gray-50 flex items-center justify-between">
              <span>Sesi Percakapan</span>
              <button
                type="button"
                onClick={onNewSession}
                className="text-amber-700 font-semibold hover:underline cursor-pointer"
                title="Buat Sesi Baru"
              >
                + Baru
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto">
              {sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => onSwitchSession(s.id)}
                    className={`flex items-center justify-between px-3 py-2 text-[11px] cursor-pointer transition-all ${
                      isActive ? "bg-amber-50 text-amber-900 font-semibold" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">{s.title}</span>
                    {isActive ? (
                      <span className="text-[9px] text-emerald-600 font-mono shrink-0">✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => onDeleteSession(s.id, e)}
                        className="text-gray-400 hover:text-red-500 p-0.5 transition-colors shrink-0"
                        title="Hapus Sesi"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* File Mention Popup */}
      {mentionQuery !== null && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
            Pilih file untuk dilampirkan
          </div>
          {mentionResults.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-gray-400">Tidak ada file yang cocok</div>
          ) : (
            <div className="max-h-44 overflow-y-auto">
              {mentionResults.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  onMouseEnter={() => setMentionIndex(i)}
                  onClick={() => insertMention(name)}
                  className={`w-full text-left px-3 py-2 text-[11px] font-medium truncate cursor-pointer transition-colors ${
                    i === mentionIndex ? "bg-amber-50 text-amber-900" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1.5 text-gray-400 -mt-0.5" />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex items-end gap-2">
      <textarea
        ref={inputRef}
        value={localInput}
        onChange={(e) => handleChange(e.target.value)}
        rows={1}
        placeholder="Tanyakan apa pun — @ untuk memilih file, / untuk aksi"
        className="flex-1 bg-gray-50/80 border border-gray-200/90 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-gray-900 placeholder:text-gray-400 transition-all shadow-2xs resize-none min-h-[38px] max-h-[180px] overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      />

      {isAnalyzing ? (
        <button
          type="button"
          onClick={() => {
            if (localInput.trim()) {
              onSteer(localInput);
              setLocalInput("");
            }
          }}
          disabled={!localInput.trim()}
          className="px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shrink-0 cursor-pointer disabled:opacity-40 shadow-2xs transition-colors"
          title="Kirim Mid-Run Steering ke AI"
        >
          Steer AI
        </button>
      ) : (
        <button
          type="submit"
          disabled={!isConnected || !localInput.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 hover:bg-black text-white disabled:opacity-30 shrink-0 cursor-pointer transition-colors shadow-2xs"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </form>
    </div>
  );
});
