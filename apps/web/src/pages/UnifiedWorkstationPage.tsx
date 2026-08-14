import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { toast } from "sonner";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationCenterPanel, CenterTab } from "../components/workstation/WorkstationCenterPanel";
import { WorkstationRightChat } from "../components/workstation/WorkstationRightChat";
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
  const [nativeFileNames, setNativeFileNames] = useState<string[]>([]);

  const [tabs, setTabs] = useState<CenterTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback(
    (side: "left" | "right", e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const startX = e.clientX;
      const computedStyle = getComputedStyle(container);
      const startWidth = side === "left"
        ? parseInt(computedStyle.getPropertyValue("--left-panel-width") || "256", 10)
        : parseInt(computedStyle.getPropertyValue("--right-panel-width") || "320", 10);

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        if (side === "left") {
          const newW = Math.max(160, Math.min(480, startWidth + delta));
          container.style.setProperty("--left-panel-width", `${newW}px`);
        } else {
          const newW = Math.max(240, Math.min(600, startWidth - delta));
          container.style.setProperty("--right-panel-width", `${newW}px`);
        }
      };

      const onUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    []
  );

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
      try {
        const response = await apiFetch(`${API_BASE}/files/workspace/${selectedWorkspaceId}`);
        const json = await response.json();
        if (Array.isArray(json.data) && json.data.length > 0) return json.data;
      } catch {}
      try {
        const response = await apiFetch(`${API_BASE}/workspaces/${selectedWorkspaceId}/files`);
        const json = await response.json();
        return json.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedWorkspaceId,
  });

  const mentionFiles = useMemo(
    () =>
      Array.from(
        new Set([...workspaceFiles.map((f) => f.name), ...nativeFileNames])
      ).map((name) => ({ name })),
    [workspaceFiles, nativeFileNames]
  );

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
    setOptimisticMessages([]);
  }, [selectedWorkspaceId, activeChatId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
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
            fileContent = json.data?.content || json.data || "A few lines of document content...";
          }
        }

        const newTab: CenterTab = {
          id: tabId,
          type: "file",
          title: fileName,
          path: filePath,
          fileType: fileName.split(".").pop() || "txt",
          content: fileContent || "Empty document...",
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(tabId);
      } catch {
        toast.error(`Failed to read file ${fileName}`);
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
          plainTextContent: "# Draft Report Document\n\nCanvas content can be edited directly...",
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

  const reloadOpenTabsContent = useCallback(async () => {
    if (!selectedWorkspaceId) return;
    try {
      let latestFiles: WorkspaceFile[] = [];
      try {
        const res = await apiFetch(`${API_BASE}/files/workspace/${selectedWorkspaceId}`);
        const json = await res.json();
        latestFiles = json.data || [];
      } catch {
        const res = await apiFetch(`${API_BASE}/workspaces/${selectedWorkspaceId}/files`);
        const json = await res.json();
        latestFiles = json.data || [];
      }

      setTabs((currentTabs) => {
        const fileTabs = currentTabs.filter((t) => t.type === "file");
        if (fileTabs.length === 0) return currentTabs;

        Promise.all(
          fileTabs.map(async (tab) => {
            const targetFile = latestFiles.find(
              (f) => f.name === tab.title || f.path === tab.path || tab.id.includes(f.name)
            );
            if (!targetFile?.id) return null;
            try {
              const contentRes = await apiFetch(`${API_BASE}/files/${targetFile.id}/content`);
              const contentJson = await contentRes.json();
              const freshContent =
                typeof contentJson.data?.content === "string"
                  ? contentJson.data.content
                  : typeof contentJson.data === "string"
                  ? contentJson.data
                  : null;
              if (freshContent !== null) {
                return { tabId: tab.id, content: freshContent };
              }
            } catch {}
            return null;
          })
        ).then((results) => {
          const updates = results.filter(Boolean) as Array<{ tabId: string; content: string }>;
          if (updates.length > 0) {
            setTabs((latest) =>
              latest.map((t) => {
                const u = updates.find((item) => item.tabId === t.id);
                return u && u.content !== t.content ? { ...t, content: u.content } : t;
              })
            );
          }
        });

        return currentTabs;
      });
    } catch {}
  }, [selectedWorkspaceId]);

  // Real-time live file polling while streaming SSE is active
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      refetchFiles();
      reloadOpenTabsContent();
    }, 1200);
    return () => clearInterval(interval);
  }, [isStreaming, refetchFiles, reloadOpenTabsContent]);

  const [queuedPrompts, setQueuedPrompts] = useState<string[]>([]);

  const handleRemoveQueuedPrompt = useCallback((index: number) => {
    setQueuedPrompts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const processNextQueuedPrompt = useCallback(() => {
    setQueuedPrompts((prevQueue) => {
      if (prevQueue.length > 0) {
        const [nextPrompt, ...remaining] = prevQueue;
        setTimeout(() => {
          handleSendMessage(nextPrompt);
        }, 350);
        return remaining;
      }
      return prevQueue;
    });
  }, []);

  const handleSendMessage = async (textOverride?: string) => {
    const rawText = textOverride !== undefined ? textOverride : inputPrompt;
    if (!rawText.trim()) return;

    // If currently streaming another turn, QUEUE the message (Google Antigravity pattern)!
    if (isStreaming && textOverride === undefined) {
      const textToQueue = rawText.trim();
      setQueuedPrompts((prev) => [...prev, textToQueue]);
      setInputPrompt("");
      toast.info("Pesan masuk ke antrian dan akan diproses otomatis setelah ini");
      return;
    }

    const userText = rawText.trim();
    if (textOverride === undefined) {
      setInputPrompt("");
    }

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    const newUserMsg: Message = {
      id: userMessageId,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };

    const newAssistantMsg: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [...prev, newUserMsg, newAssistantMsg]);
    setIsStreaming(true);
    setLiveStatus({ type: "thinking", preview: "Analyzing request & context" });

    const apiKey = import.meta.env.VITE_ARUNAKI_API_KEY;
    const streamHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      streamHeaders["x-api-key"] = apiKey;
    }

    let chatIdToUse = activeChatId;
    if (!chatIdToUse) {
      try {
        const createRes = await apiFetch(`${API_BASE}/chat`, {
          method: "POST",
          body: JSON.stringify({
            mode: selectedWorkspaceId ? "workspace" : "chat",
            workspaceId: selectedWorkspaceId || undefined,
            title: userText.slice(0, 30),
          }),
        });
        const createJson = await createRes.json();
        chatIdToUse = createJson.data.id;
        setSearchParams({ chatId: chatIdToUse });
      } catch {
        setIsStreaming(false);
        setLiveStatus(null);
        toast.error("Failed to create a new conversation");
        return;
      }
    }

    try {
      await fetchEventSource(`${API_BASE}/chat/${chatIdToUse}/stream`, {
        method: "POST",
        headers: streamHeaders,
        body: JSON.stringify({ content: userText }),
        onmessage(msg) {
          try {
            const event = JSON.parse(msg.data);
            if (event.type === "thinking") {
              setLiveStatus({ type: "thinking", preview: event.data || "Analyzing request & context" });
            } else if (event.type === "tool_live_status" || event.type === "tool_start") {
              setLiveStatus({ type: "tool_start", ...event.data });
              refetchFiles();
              reloadOpenTabsContent();

              // Auto-open file tab in center panel if AI is editing a file and it's not open yet!
              const toolData = event.data || {};
              const targetPath =
                toolData.args?.TargetFile ||
                toolData.args?.path ||
                toolData.args?.targetFile ||
                toolData.targetFile ||
                toolData.path;
              if (targetPath && typeof targetPath === "string") {
                const fileName = targetPath.split(/[/\\]/).pop();
                if (fileName) {
                  handleOpenFileTab(targetPath, fileName);
                }
              }
            } else if (event.type === "text_delta" && event.data) {
              setLiveStatus({ type: "text_delta", preview: "Generating response" });
              setOptimisticMessages((prev) => {
                const exists = prev.some((m) => m.id === assistantMessageId);
                if (!exists) {
                  return [
                    ...prev,
                    { id: assistantMessageId, role: "assistant", content: event.data, createdAt: new Date().toISOString() },
                  ];
                }
                return prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + event.data }
                    : m
                );
              });
              const canvasText = extractCanvasContent(event.data);
              if (canvasText) {
                handleTriggerCanvas({
                  id: `canvas-${Date.now()}`,
                  title: selectedWorkspaceId ? "Calculation / Structured Document" : "AI Canvas Response",
                  brandColorHeader: "#1A191B",
                  plainTextContent: canvasText,
                  createdAt: new Date().toISOString(),
                });
              }
            } else if (event.type === "done") {
              setIsStreaming(false);
              setLiveStatus(null);
              queryClient.invalidateQueries({ queryKey: ["chat-messages", chatIdToUse] });
              setTimeout(() => {
                setOptimisticMessages([]);
              }, 400);
              refetchFiles();
              reloadOpenTabsContent();
              processNextQueuedPrompt();
            } else if (event.type === "error") {
              setIsStreaming(false);
              setLiveStatus(null);
              if (event.data?.message) {
                toast.error(event.data.message);
                setOptimisticMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: m.content || `⚠️ Error: ${event.data.message}` }
                      : m
                  )
                );
              }
              processNextQueuedPrompt();
            }
          } catch {}
        },
        openWhenHidden: true,
        onclose() {
          setIsStreaming(false);
          setLiveStatus(null);
          processNextQueuedPrompt();
        },
        onerror(err) {
          setIsStreaming(false);
          setLiveStatus(null);
          processNextQueuedPrompt();
          throw err;
        },
      });
    } catch {
      setIsStreaming(false);
      processNextQueuedPrompt();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0A0A0A] text-white overflow-hidden select-none">
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
        style={{ "--left-panel-width": "256px", "--right-panel-width": "320px" } as React.CSSProperties}
      >
        <WorkstationLeftExplorer
          collapsed={leftCollapsed}
          onClose={() => setLeftCollapsed(!leftCollapsed)}
          activeWorkspace={activeWorkspace}
          workspaceFiles={workspaceFiles}
          onOpenFileTab={handleOpenFileTab}
          onOpenFolderModal={() => setShowFolderModal(true)}
          width="var(--left-panel-width, 256px)"
          onNativeFilesChange={setNativeFileNames}
        />

        <div
          className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-blue-500/50 transition-colors"
          onMouseDown={(e) => startDrag("left", e)}
        />

        <WorkstationCenterPanel
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
          canvasData={canvasData}
        />

        <div
          className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-blue-500/50 transition-colors"
          onMouseDown={(e) => startDrag("right", e)}
        />

        <WorkstationRightChat
          collapsed={rightCollapsed}
          onClose={() => setRightCollapsed(!rightCollapsed)}
          chatMessages={chatMessages}
          optimisticMessages={optimisticMessages}
          liveStatus={liveStatus}
          messagesEndRef={messagesEndRef}
          activeWorkspace={activeWorkspace}
          inputPrompt={inputPrompt}
          setInputPrompt={setInputPrompt}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          width="var(--right-panel-width, 320px)"
          files={mentionFiles}
          queuedPrompts={queuedPrompts}
          onRemoveQueuedPrompt={handleRemoveQueuedPrompt}
        />
      </div>

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
