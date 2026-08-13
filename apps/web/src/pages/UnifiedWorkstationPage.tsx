import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import Markdown from "react-markdown";
import {
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  X,
  Search,
  Sparkles,
  Send,
  Loader2,
  Bot,
  Paperclip,
  BookOpen,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { ArunakiLogo } from "../components/common/ArunakiLogo";
import FileTree from "../components/workspace/FileTree";
import { CanvasPanel, CanvasData } from "../components/chat/CanvasPanel";
import { LiveExecutionBadge, LiveStatusData } from "../components/chat/LiveExecutionBadge";
import { LiveMirrorCard } from "../components/chat/LiveMirrorCard";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  steps?: Array<{
    type: "thinking" | "plan" | "tool" | "result" | "error";
    label: string;
    detail?: string;
    status: "running" | "done" | "error";
  }>;
}

interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}

interface Workspace {
  id: string;
  name: string;
  rootPath: string | null;
  status: string;
  businessType?: string;
  files?: WorkspaceFile[];
}

interface CenterTab {
  id: string;
  type: "file" | "canvas" | "stage";
  title: string;
  path?: string;
  fileType?: string;
  content?: string;
}

function extractCanvasContent(llmText: string): string {
  if (!llmText) return "";
  const canvasMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i);
  if (canvasMatch?.[1]?.trim()) return canvasMatch[1].trim();

  const codeBlockMatch = llmText.match(/```[\w]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch?.[1]?.trim()) return codeBlockMatch[1].trim();

  const tableMatch = llmText.match(/(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/);
  if (tableMatch?.[1]?.trim()) return tableMatch[1].trim();

  return "";
}

export function UnifiedWorkstationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Active Workspace & Chat state
  const activeChatId = searchParams.get("chatId") || "";
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem("arunaki_workspace_id");
  });

  // Layout Sidebars Collapse State
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderInputPath, setFolderInputPath] = useState("");

  // Center Panel Multi-Tab & Viewer State
  const [tabs, setTabs] = useState<CenterTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Canvas On-Demand State
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);

  // Chat & Execution Streaming State
  const [inputPrompt, setInputPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Workspaces
  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/workspaces`);
      const json = await response.json();
      return json.data || [];
    },
  });

  const activeWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId) || null;

  // 2. Fetch Workspace Files when workspace is active
  const { data: workspaceFiles = [], refetch: refetchFiles } = useQuery<WorkspaceFile[]>({
    queryKey: ["workspace-files", selectedWorkspaceId],
    queryFn: async () => {
      if (!selectedWorkspaceId) return [];
      const response = await apiFetch(`${API_BASE}/workspaces/${selectedWorkspaceId}/files`);
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!selectedWorkspaceId,
  });

  // 3. Fetch Chat Messages (General Chat or Workspace Chat)
  const { data: chatMessages = [] } = useQuery<Message[]>({
    queryKey: ["chat-messages", activeChatId],
    queryFn: async () => {
      if (!activeChatId) return [];
      const response = await apiFetch(`${API_BASE}/chat/${activeChatId}/messages`);
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!activeChatId,
  });

  // Sync workspace selection changes to localStorage
  const handleSelectWorkspace = useCallback((wsId: string | null) => {
    setSelectedWorkspaceId(wsId);
    if (wsId) {
      localStorage.setItem("arunaki_workspace_id", wsId);
    } else {
      localStorage.removeItem("arunaki_workspace_id");
    }
  }, []);

  // Auto-scroll chat stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, optimisticMessages, isStreaming]);

  // Handle opening a file in the Center Panel (IDE File Reader)
  const handleOpenFileTab = useCallback(async (filePath: string, fileName: string, content?: string) => {
    const tabId = `file-${fileName}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      setActiveTabId(tabId);
      return;
    }

    try {
      let fileContent = content || "";
      if (!fileContent) {
        const targetFile = workspaceFiles.find((f) => f.name === fileName || f.path === filePath);
        if (targetFile?.id) {
          const response = await apiFetch(`${API_BASE}/files/${targetFile.id}/content`);
          const json = await response.json();
          fileContent = json.data?.content || json.data || "Beberapa baris isi dokumen...";
        }
      }

      const newTab: CenterTab = {
        id: tabId,
        type: "file",
        title: fileName,
        path: filePath,
        fileType: fileName.split(".").pop() || "txt",
        content: fileContent || "Dokumen kosong...",
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);
    } catch {
      toast.error(`Gagal membaca isi file ${fileName}`);
    }
  }, [tabs, workspaceFiles]);

  // Handle calling Canvas Panel in the Center Panel on demand
  const handleTriggerCanvas = useCallback((data?: CanvasData) => {
    const canvasTabId = "canvas-active";
    const title = data?.title || "Canvas Output";
    
    setCanvasData(data || {
      id: "canvas-1",
      title: "Workspace Canvas",
      brandColorHeader: "#1A191B",
      plainTextContent: "# Draf Laporan Dokumen\n\nIsi canvas dapat diedit langsung...",
      createdAt: new Date().toISOString(),
    });
    setIsCanvasOpen(true);

    const existingIndex = tabs.findIndex((t) => t.id === canvasTabId);
    const canvasTab: CenterTab = {
      id: canvasTabId,
      type: "canvas",
      title: `🎨 ${title}`,
    };

    if (existingIndex >= 0) {
      setTabs((prev) => {
        const copy = [...prev];
        copy[existingIndex] = canvasTab;
        return copy;
      });
    } else {
      setTabs((prev) => [...prev, canvasTab]);
    }
    setActiveTabId(canvasTabId);
  }, [tabs]);

  // Close a tab in the Center Panel
  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });

    if (tabId === "canvas-active") {
      setIsCanvasOpen(false);
    }
  }, [activeTabId]);

  // Send Chat Message or Workspace Goal
  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || isStreaming) return;
    const userText = inputPrompt.trim();
    setInputPrompt("");

    const userMessageId = `user-${Date.now()}`;
    const newMsg: Message = {
      id: userMessageId,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [...prev, newMsg]);
    setIsStreaming(true);

    // If workspace is active -> Send to Workspace Agent Stream
    if (selectedWorkspaceId) {
      try {
        await fetchEventSource(`${API_BASE}/workspaces/${selectedWorkspaceId}/agent/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userGoal: userText }),
          onmessage(msg) {
            try {
              const event = JSON.parse(msg.data);
              if (event.type === "tool_live_status") {
                setLiveStatus(event.data);
              } else if (event.type === "text_delta" && event.data) {
                // Check if text triggers Canvas
                const canvasText = extractCanvasContent(event.data);
                if (canvasText) {
                  handleTriggerCanvas({
                    id: `canvas-${Date.now()}`,
                    title: "Kalkulasi / Dokumen Terstruktur",
                    brandColorHeader: "#1A191B",
                    plainTextContent: canvasText,
                    createdAt: new Date().toISOString(),
                  });
                }
              }
            } catch {}
          },
          onclose() {
            setIsStreaming(false);
            setLiveStatus(null);
            queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
            refetchFiles();
          },
          onerror(err) {
            setIsStreaming(false);
            setLiveStatus(null);
            toast.error("Gagal menjalankan agent workspace");
            throw err;
          },
        });
      } catch {
        setIsStreaming(false);
      }
    } else {
      // General AI Chat Stream (no workspace)
      let chatIdToUse = activeChatId;
      if (!chatIdToUse) {
        try {
          const createRes = await apiFetch(`${API_BASE}/chat`, {
            method: "POST",
            body: JSON.stringify({ title: userText.slice(0, 30) }),
          });
          const createJson = await createRes.json();
          chatIdToUse = createJson.data.id;
          setSearchParams({ chatId: chatIdToUse });
        } catch {
          setIsStreaming(false);
          toast.error("Gagal membuat percakapan baru");
          return;
        }
      }

      try {
        await fetchEventSource(`${API_BASE}/chat/${chatIdToUse}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: userText }),
          onmessage(msg) {
            try {
              const event = JSON.parse(msg.data);
              if (event.type === "text_delta" && event.data) {
                const canvasText = extractCanvasContent(event.data);
                if (canvasText) {
                  handleTriggerCanvas({
                    id: `canvas-${Date.now()}`,
                    title: "AI Canvas Response",
                    brandColorHeader: "#1A191B",
                    plainTextContent: canvasText,
                    createdAt: new Date().toISOString(),
                  });
                }
              }
            } catch {}
          },
          onclose() {
            setIsStreaming(false);
            queryClient.invalidateQueries({ queryKey: ["chat-messages", chatIdToUse] });
          },
          onerror(err) {
            setIsStreaming(false);
            toast.error("Gagal mengirim pesan chat");
            throw err;
          },
        });
      } catch {
        setIsStreaming(false);
      }
    }
  };

  // Connect new folder path
  const handleConnectFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderInputPath.trim()) return;
    try {
      const response = await apiFetch(`${API_BASE}/workspaces/connect-folder`, {
        method: "POST",
        body: JSON.stringify({ folderPath: folderInputPath.trim() }),
      });
      const json = await response.json();
      const newWs = json.data;
      handleSelectWorkspace(newWs.id);
      setShowFolderModal(false);
      setFolderInputPath("");
      toast.success(`Folder terhubung: ${newWs.name}`);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    } catch {
      toast.error("Gagal menghubungkan folder workspace");
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full w-full bg-[#F4EFE6] text-[#1A191B] overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* 1. HEADER MENU BAR (Top Bar adhering to ui_wireframe_layout_v2.md)         */}
      {/* ========================================================================= */}
      <header className="h-14 bg-[#1A191B] text-[#F4EFE6] px-4 flex items-center justify-between shrink-0 shadow-md border-b border-stone-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-[#C4B5FD] transition-colors cursor-pointer"
            title="Toggle File Explorer [=]"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          <span className="font-semibold text-sm tracking-wide text-[#F4EFE6]">
            ARUNAKI WORKSTATION
          </span>

          {/* Active Workspace Capsule Badge */}
          {activeWorkspace ? (
            <button
              onClick={() => setShowFolderModal(true)}
              className="flex items-center gap-2 px-3 py-1 bg-[#252428] hover:bg-[#2f2e33] text-[#FF5E38] rounded-full text-xs font-medium border border-stone-700/60 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[200px]">{activeWorkspace.name}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowFolderModal(true)}
              className="flex items-center gap-2 px-3 py-1 bg-[#FF5E38] hover:bg-[#e04e2a] text-white rounded-full text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buka Folder Workspace</span>
            </button>
          )}
        </div>

        {/* Header Right Actions & Brand Logo */}
        <div className="flex items-center gap-3">
          {/* On-Demand Canvas Call Button in Header */}
          <button
            onClick={() => handleTriggerCanvas()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
              isCanvasOpen
                ? "bg-[#C4B5FD] text-[#1A191B] border-[#C4B5FD]"
                : "bg-[#252428] text-[#C4B5FD] border-stone-700 hover:border-[#C4B5FD]"
            )}
            title="Panggil / Buka Canvas Panel"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>🎨 Canvas</span>
          </button>

          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-[#C4B5FD] transition-colors cursor-pointer"
            title="Toggle Chat Panel"
          >
            <Bot className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 rounded-full bg-[#252428] flex items-center justify-center border border-stone-700">
            <ArunakiLogo className="w-5 h-5" fill="#FF5E38" />
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN THREE-PANEL BODY (Left Explorer, Center Editor/Canvas, Right Chat)  */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ----------------------------------------------------------------------- */}
        {/* PANEL KIRI: EKSPLORE (FOLDER)                                          */}
        {/* ----------------------------------------------------------------------- */}
        {!leftCollapsed && (
          <aside className="w-64 bg-[#1A191B] text-[#F4EFE6] border-r border-stone-800 flex flex-col shrink-0">
            <div className="p-3 border-b border-stone-800 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-[#C4B5FD] uppercase flex items-center gap-2">
                <Folder className="w-4 h-4 text-[#FF5E38]" />
                EKSPLORE (FOLDER)
              </span>
              <button
                onClick={() => setLeftCollapsed(true)}
                className="text-stone-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeWorkspace ? (
              <div className="flex-1 flex flex-col p-2 overflow-y-auto">
                <div className="mb-2 px-1">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Cari file..."
                      className="w-full bg-[#252428] border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#FF5E38]"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <FileTree
                    files={workspaceFiles}
                    workspaceName={activeWorkspace?.name || "Workspace"}
                    onFileClick={(path, name, content) => handleOpenFileTab(path, name, content)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <FolderOpen className="w-10 h-10 text-stone-600 mb-2" />
                <p className="text-xs text-stone-400 mb-3">Belum ada folder workspace yang dibuka</p>
                <button
                  onClick={() => setShowFolderModal(true)}
                  className="w-full py-2 bg-[#FF5E38] hover:bg-[#e04e2a] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Buka Folder Workspace
                </button>
              </div>
            )}
          </aside>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* PANEL TENGAH: MAIN CONTENT / EDITOR / IDE FILE READER & ON-DEMAND CANVAS*/}
        {/* ----------------------------------------------------------------------- */}
        <main className="flex-1 flex flex-col bg-[#F4EFE6] overflow-hidden relative">
          {/* Top Multi-Tab Bar */}
          {tabs.length > 0 && (
            <div className="h-10 bg-[#EAE3D2] border-b border-stone-300 flex items-center px-2 gap-1 overflow-x-auto shrink-0 select-none">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-colors max-w-[200px] group border-t border-x border-transparent",
                      isActive
                        ? "bg-[#F4EFE6] text-[#1A191B] border-stone-300 shadow-sm font-semibold"
                        : "text-stone-600 hover:bg-stone-300/50"
                    )}
                  >
                    {tab.type === "canvas" ? (
                      <Sparkles className="w-3.5 h-3.5 text-[#FF5E38] shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    )}
                    <span className="truncate">{tab.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dynamic Content Body */}
          <div className="flex-1 p-4 overflow-auto">
            {activeTab ? (
              activeTab.type === "canvas" ? (
                /* ON-DEMAND CANVAS PANEL (Triggered by AI Chat or Header Button) */
                <div className="h-full w-full bg-white rounded-2xl p-4 shadow-md border border-stone-200 flex flex-col">
                  <CanvasPanel
                    isOpen={true}
                    onClose={() => handleCloseTab("canvas-active")}
                    canvasData={canvasData}
                  />
                </div>
              ) : (
                /* IDE FILE READER / DOCUMENT VIEWER */
                <div className="h-full w-full bg-white rounded-2xl p-6 shadow-md border border-stone-200 flex flex-col">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-[#FF5E38]" />
                      <h2 className="font-bold text-sm text-[#1A191B]">{activeTab.title}</h2>
                      <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                        {activeTab.fileType?.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-stone-400 truncate max-w-md">{activeTab.path}</span>
                  </div>

                  <div className="flex-1 overflow-auto bg-stone-50 p-4 rounded-xl border border-stone-200 font-mono text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">
                    {activeTab.content}
                  </div>
                </div>
              )
            ) : (
              /* WELCOME / GETTING STARTED VIEW (When no tabs open) */
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-[#1A191B] flex items-center justify-center mb-4 shadow-lg">
                  <ArunakiLogo className="w-10 h-10" fill="#FF5E38" />
                </div>
                <h1 className="text-xl font-bold text-[#1A191B] mb-2">
                  Selamat Datang di Arunaki Document Workstation
                </h1>
                <p className="text-xs text-stone-500 max-w-md mb-6 leading-relaxed">
                  IDE Dokumen terpadu untuk mengolah spreadsheet Excel, dokumen Word, dan PDF secara mandiri.
                </p>

                <div className="grid grid-cols-2 gap-4 max-w-lg w-full text-left">
                  <div
                    onClick={() => setShowFolderModal(true)}
                    className="p-4 bg-white rounded-xl border border-stone-300 hover:border-[#FF5E38] transition-colors cursor-pointer shadow-sm group"
                  >
                    <FolderOpen className="w-6 h-6 text-[#FF5E38] mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xs font-bold text-[#1A191B]">Buka Folder Workspace</h3>
                    <p className="text-[11px] text-stone-400">Hubungkan folder lokal berisi file kantor</p>
                  </div>

                  <div
                    onClick={() => handleTriggerCanvas()}
                    className="p-4 bg-white rounded-xl border border-stone-300 hover:border-[#C4B5FD] transition-colors cursor-pointer shadow-sm group"
                  >
                    <Sparkles className="w-6 h-6 text-[#C4B5FD] mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xs font-bold text-[#1A191B]">Panggil AI Canvas</h3>
                    <p className="text-[11px] text-stone-400">Buka panel draf terstruktur & kalkulasi</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ----------------------------------------------------------------------- */}
        {/* PANEL KANAN: CHAT AREA & CHAT BOX (INTEGRATED AGENT / CHAT SYSTEM)    */}
        {/* ----------------------------------------------------------------------- */}
        {!rightCollapsed && (
          <aside className="w-80 bg-[#1A191B] text-[#F4EFE6] border-l border-stone-800 flex flex-col shrink-0">
            <div className="p-3 border-b border-stone-800 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-[#C4B5FD] uppercase flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#FF5E38]" />
                CHAT AREA
              </span>
              <button
                onClick={() => setRightCollapsed(true)}
                className="text-stone-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Stream Messages */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {chatMessages.length === 0 && optimisticMessages.length === 0 ? (
                <div className="p-4 bg-[#252428] rounded-xl border border-stone-800 text-center">
                  <Sparkles className="w-6 h-6 text-[#FF5E38] mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white mb-1">
                    {activeWorkspace ? "Autonomous Agent Ready" : "AI Assistant Ready"}
                  </p>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Ketik perintah atau tanya seputar dokumen. Gunakan <code className="text-[#FF5E38]">@filename</code> untuk mereferensikan file.
                  </p>
                </div>
              ) : (
                [...chatMessages, ...optimisticMessages].map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-1 text-xs",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-2xl max-w-[90%] leading-relaxed",
                        msg.role === "user"
                          ? "bg-[#FF5E38] text-white rounded-tr-none"
                          : "bg-[#252428] text-stone-200 rounded-tl-none border border-stone-800"
                      )}
                    >
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                ))
              )}

              {/* Live Execution Status Badge */}
              {liveStatus && <LiveExecutionBadge status={liveStatus} />}
              {liveStatus?.screenshot && (
                <LiveMirrorCard screenshotUrl={liveStatus.screenshot} title="Live Desktop Execution" />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Capsule Chat Input Box */}
            <div className="p-3 border-t border-stone-800 bg-[#1A191B]">
              <div className="bg-[#252428] rounded-2xl p-2.5 border border-stone-700 focus-within:border-[#FF5E38] transition-colors relative">
                <textarea
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    activeWorkspace
                      ? "Beri tugas (contoh: Rekap @Laporan.xlsx ke Excel)..."
                      : "Ketik pertanyaan atau tugas di sini..."
                  }
                  rows={2}
                  className="w-full bg-transparent text-xs text-[#F4EFE6] placeholder-stone-400 resize-none focus:outline-none"
                />

                <div className="flex items-center justify-between pt-1 border-t border-stone-700/50 mt-1">
                  <div className="flex items-center gap-2">
                    <button className="text-stone-400 hover:text-white p-1 rounded transition-colors cursor-pointer">
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                    {activeWorkspace && (
                      <span className="text-[10px] bg-stone-800 text-[#FF5E38] px-2 py-0.5 rounded-full font-medium">
                        📁 Workspace Agent
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputPrompt.trim() || isStreaming}
                    className="w-7 h-7 bg-[#FF5E38] hover:bg-[#e04e2a] disabled:opacity-40 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. FOOTER STATUS BAR (Curved/Capsule Bottom Bar for System & KB Status)     */}
      {/* ========================================================================= */}
      <footer className="h-8 bg-[#1A191B] text-stone-400 px-4 flex items-center justify-between text-[11px] shrink-0 border-t border-stone-800">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-stone-300">
            <Folder className="w-3.5 h-3.5 text-[#FF5E38]" />
            {activeWorkspace ? activeWorkspace.rootPath || activeWorkspace.name : "Tanpa Workspace"}
          </span>
          {activeWorkspace && (
            <span className="text-stone-500">
              • {workspaceFiles.length} file terhubung
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[#C4B5FD]">
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge Base: Active (Garment)
          </span>
          <span className="text-stone-500">• Model: Nemotron-3</span>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 4. CONNECT FOLDER MODAL DIALOG                                            */}
      {/* ========================================================================= */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A191B] text-white rounded-2xl max-w-md w-full p-5 border border-stone-700 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
              <h3 className="font-bold text-sm text-[#F4EFE6] flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#FF5E38]" />
                Hubungkan Folder Workspace
              </h3>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-stone-300 mb-1.5 font-medium">
                  Path Folder Lokal
                </label>
                <input
                  type="text"
                  value={folderInputPath}
                  onChange={(e) => setFolderInputPath(e.target.value)}
                  placeholder="Contoh: E:\DocumentWorkspaces\Garment"
                  className="w-full bg-[#252428] border border-stone-700 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#FF5E38]"
                />
              </div>

              {workspaces.length > 0 && (
                <div>
                  <label className="block text-xs text-stone-400 mb-1.5 font-medium">
                    Atau Pilih Workspace Terbaru:
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        onClick={() => {
                          handleSelectWorkspace(ws.id);
                          setShowFolderModal(false);
                          toast.success(`Dihubungkan ke ${ws.name}`);
                        }}
                        className="p-2 rounded-xl bg-[#252428] hover:bg-[#2f2e33] border border-stone-800 transition-colors cursor-pointer flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-white truncate">{ws.name}</span>
                        <span className="text-[10px] text-stone-400 truncate max-w-[150px]">
                          {ws.rootPath}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 bg-[#252428] hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF5E38] hover:bg-[#e04e2a] text-white rounded-xl text-xs font-semibold"
                >
                  Hubungkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
