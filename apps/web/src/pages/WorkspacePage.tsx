import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import Markdown from "react-markdown";
import {
  Folder,
  FolderCheck,
  Settings,
  Info,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  MessageSquare,
  ArrowUp,
  X,
  Plus,
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
  FolderOpen,
  RotateCw,
  GripHorizontal,
  Move,
} from "lucide-react";
import { toast } from "sonner";
import FileTree from "../components/workspace/FileTree";
import { API_BASE } from "../lib/api";

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

export function WorkspacePage() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectedWsRef = useRef<string | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);

  // Multi-Session Chat & Slash Command State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("session_default");
  const [showSlashMenu, setShowSlashMenu] = useState(false);

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

  const [chatPosition, setChatPosition] = useState<{ x: number; y: number }>({ x: 260, y: 70 });
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

  const handlePillClick = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
    const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
    if (dx < 5 && dy < 5) {
      setIsChatMinimized(false);
    }
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
          setChatPosition({
            x: Math.max(10, Math.min(window.innerWidth - 120, e.clientX - dragOffsetRef.current.x)),
            y: Math.max(10, Math.min(window.innerHeight - 60, e.clientY - dragOffsetRef.current.y)),
          });
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

          setChatSize({ width: newW, height: newH });
          setChatPosition({ x: newX, y: newY });
        });
      }
    };

    const handleMouseUp = () => {
      if (isDraggingChatRef.current || isResizingChatRef.current) {
        isDraggingChatRef.current = false;
        isResizingChatRef.current = false;
        resizeDirRef.current = null;
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
    setShowSlashMenu(false);
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
    setShowSlashMenu(false);
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
        const res = await fetch(`${API_BASE}/workspaces`);
        const json = await res.json();
        const workspaces = json.data || [];

        // Find workspace with rootPath (connected folder)
        const connected = workspaces.find((ws: any) => ws.rootPath);

        if (connected && !cancelled) {
          setWorkspaceId(connected.id);
          setConnectedFolderPath(connected.rootPath);
          setIsConnected(true);
          connectedWsRef.current = connected.id;
          localStorage.setItem('arunaki_workspace_id', connected.id);
          queryClient.invalidateQueries({ queryKey: ["wsFiles", connected.id] });

          // Load cached analysis result (if available from previous session)
          try {
            const analysisRes = await fetch(`${API_BASE}/workspaces/${connected.id}/analysis`);
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

  // Show modal only after restore attempt
  useEffect(() => {
    if (!isRestoring && !workspaceId) {
      setIsModalOpen(true);
    }
  }, [isRestoring, workspaceId]);

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
                const doneLabel =
                  event.data?.result?.preview ||
                  (event.data?.result?.status === "success"
                    ? `Selesai: ${event.data.toolName}`
                    : `Gagal: ${event.data.toolName}`);
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
      const wsRes = await fetch(`${API_BASE}/workspaces`, {
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

        const uploadRes = await fetch(`${API_BASE}/files/upload`, {
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
      setIsModalOpen(false);
      connectedWsRef.current = newId;
      localStorage.setItem('arunaki_workspace_id', newId);
      queryClient.invalidateQueries({ queryKey: ["wsFiles", newId] });
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

  const handleConnectFolder = useCallback(async () => {
    // Check if running in Electron with native folder picker
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    const isElectron = !!(desktop?.pickFolder && desktop?.getFolderTree);

    if (isElectron) {
      try {
        // 1. Open native folder dialog (like VS Code)
        const result = await desktop.pickFolder();
        if (!result?.path) return;

        const folderPath = result.path;
        const folderName = folderPath.split(/[\\/]/).pop() || 'Workspace';

        setIsCreating(true);
        toast.info(`Membaca struktur folder "${folderName}"...`);

        // 2. Get full folder tree (files stay on disk — VS Code approach)
        const scan = await desktop.getFolderTree(folderPath);

        if (!scan?.tree) {
          toast.error('Gagal membaca folder.');
          setIsCreating(false);
          return;
        }

        // 3. Count all files in tree
        const countFiles = (nodes: any[]): number =>
          nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
        const fileCount = countFiles(scan.tree);

        // 4. Register workspace in backend (rootPath stored — API can read files by path)
        const wsRes = await fetch(`${API_BASE}/workspaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName, rootPath: folderPath, businessType: 'generic' }),
        });
        const wsJson = await wsRes.json();
        const newId = wsJson.data?.id;
        if (!newId) {
          toast.error('Gagal membuat workspace');
          setIsCreating(false);
          return;
        }

        // 5. Index files in backend for AI before marking the folder connected.
        const connectRes = await fetch(`${API_BASE}/workspaces/${newId}/connect-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath }),
        });
        const connectJson = await connectRes.json().catch(() => null);
        if (!connectRes.ok || !connectJson?.data) {
          throw new Error(connectJson?.error?.message || 'Backend gagal mengindeks folder');
        }

        // 6. Folder is readable by Electron and indexed by the backend.
        setNativeTree(scan.tree);
        setNativeFileCount(fileCount);
        setConnectedFolderPath(folderPath);
        setWorkspaceId(newId);
        setIsConnected(true);
        setIsModalOpen(false);
        connectedWsRef.current = newId;
        localStorage.setItem('arunaki_workspace_id', newId);
        await queryClient.invalidateQueries({ queryKey: ['wsFiles', newId] });
        toast.success(`Folder "${folderName}" terhubung! (${fileCount} file)`);
        triggerAutoAnalysis(newId);
      } catch (err: any) {
        console.error('Connect folder failed:', err);
        toast.error(`Gagal menghubungkan folder: ${err.message || 'Periksa apakah backend berjalan'}`);
        setIsCreating(false);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    
    // Fallback to browser File System Access API
    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
        const folderName = dirHandle.name;

        setIsCreating(true);

        const files: File[] = [];
        const IGNORED_NAMES = new Set([
          "node_modules", ".git", "dist", "build", ".next", ".venv", "__pycache__", ".idea", ".vscode", "coverage", ".cache"
        ]);

        const readEntries = async (handle: any, path: string) => {
          if (files.length >= 100) return;

          try {
            const entries = handle.values ? handle.values() : [];
            for await (const entry of entries) {
              if (files.length >= 100) break;
              if (!entry || !entry.name || entry.name.startsWith(".") || IGNORED_NAMES.has(entry.name)) continue;

              if (entry.kind === "file") {
                try {
                  const file = await entry.getFile();
                  files.push(new File([file], `${path}${file.name}`, { type: file.type }));
                } catch {
                  // Skip unreadable files silently
                }
              } else if (entry.kind === "directory") {
                await readEntries(entry, `${path}${entry.name}/`);
              }
            }
          } catch {
            // Fallback for directory reading
          }
        };

        await readEntries(dirHandle, "");
        await doConnect(files, folderName);
      } catch (e: any) {
        setIsCreating(false);
        if (e?.name === "AbortError") {
          return;
        }
        // Fallback to webkitdirectory if showDirectoryPicker fails
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [doConnect, queryClient]);

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

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}`);
      const json = await res.json();
      return json.data;
    },
    enabled: !!workspaceId,
  });

  const { data: files = [] } = useQuery<any[]>({
    queryKey: ["wsFiles", workspaceId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/files/workspace/${workspaceId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!workspaceId,
  });

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
      await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/abort`, { method: "POST" });
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
      const res = await fetch(`${API_BASE}/agent/steer`, {
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

  const handleSendChat = useCallback(async (inputText: string) => {
    if (!isConnected || !workspaceId || !inputText.trim() || isAnalyzing) return;
    const input = inputText.trim();

    // Handle slash commands
    if (input.startsWith("/")) {
      const lower = input.toLowerCase();
      if (lower === "/session new" || lower === "/new") {
        createNewSession();
        return;
      }
      if (lower === "/clear") {
        setSessions((prev) => {
          const updated = prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [] } : s));
          localStorage.setItem(`arunaki_sessions_${workspaceId}`, JSON.stringify(updated));
          return updated;
        });
        setShowSlashMenu(false);
        toast.info("Riwayat pesan di sesi ini dibersihkan.");
        return;
      }
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

    setShowSlashMenu(false);

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

  const handleDisconnectFolder = () => {
    setIsConnected(false);
    setWorkspaceId(null);
    setAgentSteps([]);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setNativeTree(null);
    setNativeFileCount(0);
    connectedWsRef.current = null;
    localStorage.removeItem('arunaki_workspace_id');
    setIsModalOpen(true);
  };

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
    <div className="flex-1 overflow-hidden h-full bg-[#FAFAFA] p-4 sm:p-6 lg:p-8 flex flex-col relative min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 mb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white border border-gray-200/90 shadow-2xs flex items-center justify-center text-gray-800 shrink-0">
            <Folder className="w-5 h-5 text-gray-800" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              {workspace?.name || "Workspace Strategis & Analisis"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {isConnected
                ? `${fileCount} file terhubung dari workspace ini.`
                : "Pusat pengelolaan dokumen korporat, otomatisasi ekstraksi data, dan intelijen berbasis AI."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isConnected ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Hubungkan Folder</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnectFolder}
              className="flex items-center gap-2 border border-gray-200/90 bg-white hover:bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer transition-all active:scale-98"
            >
              <FolderCheck className="w-4 h-4 text-emerald-600" />
              <span>Terhubung: {workspace?.name || "Workspace"}</span>
            </button>
          )}

          <button
            onClick={() => setIsManageModalOpen(true)}
            className="flex items-center gap-2 border border-gray-200/90 bg-white hover:bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs cursor-pointer transition-all active:scale-98"
          >
            <Settings className="w-4 h-4 text-gray-600" />
            <span>Kelola Workspace</span>
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
        {/* Left Column - Clean Workspace Canvas / VS Code Central Editor */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
          {openEditorFile ? (
            /* VS CODE CENTER WORKSPACE EDITOR (Clean White Theme) */
            <div className="flex-1 flex flex-col bg-white text-gray-900 rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden h-full animate-fade-in">
              {/* Editor Header Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-200/80 text-gray-900 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="font-semibold text-xs text-gray-900 truncate">{openEditorFile.name}</span>
                  <span className="text-[11px] text-gray-500 font-mono truncate hidden sm:inline">{openEditorFile.path}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!openEditorFile.isEditing ? (
                    <button
                      type="button"
                      onClick={() => setOpenEditorFile({ ...openEditorFile, isEditing: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white hover:bg-gray-100 text-gray-800 rounded-xl border border-gray-200/90 font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Edit Content</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveEditorContent}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors shadow-2xs cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenEditorFile(null)}
                    className="p-1.5 hover:bg-gray-200/70 text-gray-500 hover:text-gray-900 rounded-xl transition-colors cursor-pointer"
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
                    onChange={(e) => setOpenEditorFile({ ...openEditorFile, content: e.target.value })}
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
              <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-200/80 text-[11px] text-gray-600 flex items-center justify-between font-mono shrink-0">
                <span>{openEditorFile.isEditing ? "Mode Sunting (Aktif)" : "Mode Pratinjau Terbuka (Read-Only)"}</span>
                <button
                  type="button"
                  onClick={() => setOpenEditorFile(null)}
                  className="hover:text-gray-900 text-emerald-600 font-semibold underline cursor-pointer"
                >
                  Tutup Editor File & Kembali ke Workspace Overview
                </button>
              </div>
            </div>
          ) : (
            /* CLEAN SPACIOUS WORKSPACE CANVAS (No embedded chat in middle!) */
            <div className="bg-white rounded-2xl border border-gray-200/90 p-8 shadow-2xs flex-1 h-full flex flex-col justify-between overflow-hidden min-w-0">
              <div className="space-y-6 max-w-xl mx-auto flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto text-amber-600 shadow-2xs">
                  <FolderOpen className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    {workspace?.name || "Workspace Arunaki AI"}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                    {!isConnected
                      ? "Belum ada folder terhubung. Hubungkan folder bisnis Anda untuk mengaktifkan AI Document Agent."
                      : `Terhubung dengan ${fileCount} file dokumen. Klik file dari Explorer kanan untuk membuka editor di tengah.`}
                  </p>
                </div>

                {!isConnected ? (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-98"
                  >
                    <Folder className="w-4 h-4" />
                    <span>Hubungkan Folder Komputer</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setIsChatMinimized(false)}
                      className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <span>Buka Popup Arunaki AI Chat 💬</span>
                    </button>

                    <button
                      onClick={handleRefreshFolder}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <RotateCw className="w-4 h-4 text-gray-600" />
                      <span>Refresh Folder</span>
                    </button>
                  </div>
                )}
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

      {/* POPUP MODAL: Folder Connection Modal */}
      {/* POPUP MODAL: Folder Connection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-2xl w-full max-w-lg p-6 sm:p-8 flex flex-col items-center justify-center relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="bg-[#F8F9FA] rounded-2xl p-6 sm:p-8 w-full flex flex-col items-center text-center gap-4 border border-gray-100 mt-2">
              <Folder className="w-16 h-16 text-gray-900 stroke-[1.5]" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1.5">
                  Buka Folder
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Pilih folder di komputer Anda. Nama workspace diambil dari nama folder.
                </p>
              </div>

              <button
                onClick={handleConnectFolder}
                disabled={isCreating}
                className="w-full py-3 bg-black text-white hover:bg-gray-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs mt-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <Folder className="w-4 h-4" />
                    <span>Pilih Folder di Komputer</span>
                  </>
                )}
              </button>

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
            </div>
          </div>
        </div>
      )}

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
            onMouseDown={handleStartDragChat}
            onClick={handlePillClick}
            style={{ left: `${chatPosition.x}px`, top: `${chatPosition.y}px` }}
            className={`pointer-events-auto absolute bg-gray-900 text-white rounded-full px-4 py-2.5 shadow-2xl flex items-center gap-3 cursor-move select-none border border-gray-700 hover:bg-black transition-none ${
              isDraggingChat ? "shadow-amber-500/40 ring-2 ring-amber-400/50 scale-102" : ""
            }`}
          >
            <Move className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <Bot className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold shrink-0">Arunaki AI Assistant</span>
            {isConnected && (
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-mono shrink-0">
                {fileCount} Dokumen
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsChatMinimized(false);
              }}
              className="p-1 hover:bg-gray-800 text-gray-300 hover:text-white rounded-full transition-colors cursor-pointer ml-0.5 shrink-0"
              title="Buka Jendela Chat"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
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
                <Bot className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold text-xs text-white truncate">Asisten Intelijen Arunaki AI</span>
                {isConnected && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-mono shrink-0">
                    {fileCount} Dokumen
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setChatPosition({ x: 260, y: 70 });
                    setChatSize({ width: 540, height: 560 });
                    setIsChatExpanded(false);
                    toast.success("Posisi & ukuran chat telah di-reset ke standar.");
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

              {/* Agent Progress & Thinking Drawer */}
              {agentSteps.length > 0 && (
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
              {/* Slash Menu Popover */}
              {showSlashMenu && (
                <div className="absolute bottom-full mb-2 left-3 right-3 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-gray-100 text-[11px] font-bold text-gray-900">
                    <span>Sesi Percakapan & Perintah Slash (`/`)</span>
                    <button type="button" onClick={() => setShowSlashMenu(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>

                  <button
                    type="button"
                    onClick={() => createNewSession()}
                    className="w-full text-left px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>+ Buat Sesi Percakapan Baru</span>
                    <span className="text-[9px] font-mono bg-amber-200/60 px-1.5 py-0.5 rounded">/session new</span>
                  </button>

                  {/* Sessions List */}
                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                    {sessions.map((s) => {
                      const isActive = s.id === activeSessionId;
                      return (
                        <div
                          key={s.id}
                          onClick={() => switchSession(s.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                            isActive ? "bg-gray-900 text-white font-semibold" : "bg-gray-50 hover:bg-gray-100 text-gray-800"
                          }`}
                        >
                          <span className="truncate flex-1 pr-2">{s.title}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isActive ? (
                              <span className="text-[9px] text-emerald-400 font-mono">✓ Aktif</span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => deleteSession(s.id, e)}
                                className="text-gray-400 hover:text-red-500 p-0.5 transition-colors"
                                title="Hapus Sesi"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <ChatInputForm
                onSend={handleSendChat}
                onSteer={handleSteerAgent}
                isAnalyzing={isAnalyzing}
                isConnected={isConnected}
                onToggleSlashMenu={() => setShowSlashMenu((prev) => !prev)}
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
  onToggleSlashMenu: () => void;
}

const ChatInputForm = memo(function ChatInputForm({
  onSend,
  onSteer,
  isAnalyzing,
  isConnected,
  onToggleSlashMenu,
}: ChatInputFormProps) {
  const [localInput, setLocalInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;
    if (isAnalyzing) {
      onSteer(localInput);
    } else {
      onSend(localInput);
    }
    setLocalInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleSlashMenu}
        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl text-xs font-mono font-bold shrink-0 transition-colors cursor-pointer border border-gray-200/80"
        title="Tampilkan Menu Perintah Slash (/)"
      >
        /
      </button>

      <input
        type="text"
        value={localInput}
        onChange={(e) => setLocalInput(e.target.value)}
        placeholder="Tanyakan analisis dokumen, korelasi data..."
        className="flex-1 bg-gray-50/80 border border-gray-200/90 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-gray-900 placeholder:text-gray-400 transition-all shadow-2xs"
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
  );
});
