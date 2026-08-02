import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
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
import { API_BASE, apiFetch } from "../lib/api";

interface AgentStep {
  type: "thinking" | "plan" | "tool" | "result" | "error";
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
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
  const [isConnected, setIsConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectedWsRef = useRef<string | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("session_default");

  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [activeToolAction, setActiveToolAction] = useState<{ toolName: string; args?: any } | null>(null);
  const [isStepsExpanded, setIsStepsExpanded] = useState(true);

  const agentStepsRef = useRef<AgentStep[]>([]);
  agentStepsRef.current = agentSteps;

  const [nativeTree, setNativeTree] = useState<any[] | null>(null);
  const [nativeFileCount, setNativeFileCount] = useState(0);
  const [connectedFolderPath, setConnectedFolderPath] = useState<string | null>(null);

  const [heartbeatAlert, setHeartbeatAlert] = useState<string | null>(null);
  const previousFileCountRef = useRef<number>(0);

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

          if (dir.includes('e')) {
            newW = Math.max(240, Math.min(window.innerWidth - newX - 10, resizeStartRef.current.startW + deltaX));
          }
          if (dir.includes('w')) {
            const rightEdge = resizeStartRef.current.startXPos + resizeStartRef.current.startW;
            const rawW = resizeStartRef.current.startW - deltaX;
            const clampedW = Math.max(240, Math.min(rightEdge - 10, rawW));
            newW = clampedW;
            newX = rightEdge - clampedW;
          }
          if (dir.includes('s')) {
            newH = Math.max(180, Math.min(window.innerHeight - newY - 10, resizeStartRef.current.startH + deltaY));
          }
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
    }

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

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/workspaces`);
        const json = await res.json();
        const workspaces = json.data || [];

        const connected = workspaces.find((ws: any) => ws.rootPath);

        if (connected && !cancelled) {
          setWorkspaceId(connected.id);
          setConnectedFolderPath(connected.rootPath);
          setIsConnected(true);
          connectedWsRef.current = connected.id;
          localStorage.setItem('arunaki_workspace_id', connected.id);
          queryClient.invalidateQueries({ queryKey: ["wsFiles", connected.id] });

          try {
            const analysisRes = await apiFetch(`${API_BASE}/workspaces/${connected.id}/analysis`);
            const analysisJson = await analysisRes.json();
            if (analysisJson.data?.analysisResult && !cancelled) {
              setAnalysisResult(analysisJson.data.analysisResult);
            }
          } catch {
          }

          setIsRestoring(false);

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
      }
      if (!cancelled) setIsRestoring(false);
    };
    restore();
    return () => { cancelled = true; };
  }, [queryClient]);

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
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (mentionQuery === null || mentionResults.length === 0) return;
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

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={localInput}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Tanyakan apa pun — @ untuk memilih file, / untuk aksi"
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
    </div>
  );
});
