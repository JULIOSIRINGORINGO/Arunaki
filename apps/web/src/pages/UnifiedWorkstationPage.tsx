import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { toast } from "sonner";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationCenterPanel, CenterTab } from "../components/workstation/WorkstationCenterPanel";
import { WorkstationRightChat } from "../components/workstation/WorkstationRightChat";
import { WorkstationFooter } from "../components/workstation/WorkstationFooter";
import { ConnectFolderModal } from "../components/workstation/ConnectFolderModal";
import { CanvasData } from "../components/chat/CanvasPanel";
import { LiveStatusData } from "../components/chat/LiveExecutionBadge";
import { API_BASE, apiFetch } from "../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
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

  const activeChatId = searchParams.get("chatId") || "";
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem("arunaki_workspace_id");
  });

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);

  const [tabs, setTabs] = useState<CenterTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Workspaces
  const { data: workspaces = [], refetch: refetchWorkspaces } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/workspaces`);
      const json = await response.json();
      return json.data || [];
    },
  });

  const activeWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId) || null;

  // 2. Fetch Workspace Files
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

  // 3. Fetch Chat Messages
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

  const handleSelectWorkspace = useCallback((wsId: string | null) => {
    setSelectedWorkspaceId(wsId);
    if (wsId) {
      localStorage.setItem("arunaki_workspace_id", wsId);
    } else {
      localStorage.removeItem("arunaki_workspace_id");
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, optimisticMessages, isStreaming]);

  const handleOpenFileTab = useCallback(
    async (filePath: string, fileName: string, content?: string) => {
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
    },
    [tabs, workspaceFiles]
  );

  const handleTriggerCanvas = useCallback(
    (data?: CanvasData) => {
      const canvasTabId = "canvas-active";
      const title = data?.title || "Canvas Output";

      setCanvasData(
        data || {
          id: "canvas-1",
          title: "Workspace Canvas",
          brandColorHeader: "#1A191B",
          plainTextContent: "# Draf Laporan Dokumen\n\nIsi canvas dapat diedit langsung...",
          createdAt: new Date().toISOString(),
        }
      );

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
    },
    [tabs]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
        }
        return next;
      });
    },
    [activeTabId]
  );

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

  return (
    <div className="flex flex-col h-full w-full bg-[#0A0A0A] text-white overflow-hidden select-none">
      <div className="flex-1 flex overflow-hidden relative">
        <WorkstationLeftExplorer
          collapsed={leftCollapsed}
          onClose={() => setLeftCollapsed(true)}
          activeWorkspace={activeWorkspace}
          workspaceFiles={workspaceFiles}
          onOpenFileTab={handleOpenFileTab}
          onOpenFolderModal={() => setShowFolderModal(true)}
        />

        <WorkstationCenterPanel
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
          canvasData={canvasData}
          onOpenFolderModal={() => setShowFolderModal(true)}
          onTriggerCanvas={() => handleTriggerCanvas()}
        />

        <WorkstationRightChat
          collapsed={rightCollapsed}
          onClose={() => setRightCollapsed(true)}
          chatMessages={chatMessages}
          optimisticMessages={optimisticMessages}
          liveStatus={liveStatus}
          messagesEndRef={messagesEndRef}
          activeWorkspace={activeWorkspace}
          inputPrompt={inputPrompt}
          setInputPrompt={setInputPrompt}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
        />
      </div>

      <WorkstationFooter activeWorkspace={activeWorkspace} fileCount={workspaceFiles.length} />

      <ConnectFolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        workspaces={workspaces}
        onSelectWorkspace={handleSelectWorkspace}
        onRefreshWorkspaces={refetchWorkspaces}
      />
    </div>
  );
}
