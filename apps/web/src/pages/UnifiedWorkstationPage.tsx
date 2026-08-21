import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { toast } from "sonner";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationCenterPanel, CenterTab } from "../components/workstation/WorkstationCenterPanel";
import { WorkstationRightChat } from "../components/workstation/WorkstationRightChat";
import { ConnectFolderModal } from "../components/workstation/ConnectFolderModal";
import { SearchSectionModal } from "../components/workstation/SearchSectionModal";
import { LiveStatusData, StepItem } from "../components/workstation/LiveExecutionBadge";
import { API_BASE, apiFetch } from "../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  executionSteps?: StepItem[];
  thoughtSec?: number;
  metadata?: string | Record<string, any>;
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

export interface CanvasItem {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  timeStr?: string;
}

function extractCanvasTitle(content: string): string {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "Document Canvas";
  const firstLine = lines[0].replace(/^#+\s*/, "").replace(/[`*|]/g, "").trim();
  if (firstLine.length > 0 && firstLine.length <= 36) return firstLine;
  if (firstLine.length > 36) return firstLine.slice(0, 34) + "...";
  return "Document Canvas";
}

function extractCanvasContent(llmText: string): string {
  if (!llmText) return "";

  // 1. Explicit [CANVAS]...[/CANVAS] block
  const completeMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i);
  if (completeMatch?.[1]?.trim()) return completeMatch[1].trim();

  // 2. Real-time streaming [CANVAS]...
  const streamMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*)$/i);
  if (streamMatch?.[1]?.trim()) return streamMatch[1].trim();

  // 3. Explicit deliverable codeblocks (```deliverable, ```canvas, ```csv, ```table, ```excel)
  const fencedMatch = llmText.match(/```(?:deliverable|canvas|document|csv|table|excel)\s*\n([\s\S]*?)\n```/i);
  if (fencedMatch?.[1]?.trim() && fencedMatch[1].trim().length > 20) {
    return fencedMatch[1].trim();
  }

  // 4. Real Markdown Table (Must have proper table headers and data rows)
  if (llmText.includes("|") && (llmText.includes("---") || llmText.includes("-|-"))) {
    const normalized = llmText.replace(/\|\|\s*\|/g, "|\n|");
    const tableMatch = normalized.match(/(\|.+?\|\r?\n\|[-:\s|]+\|\r?\n(?:\|.+?\|\r?\n?)+)/);
    if (tableMatch?.[0]?.trim()) {
      return tableMatch[0].trim();
    }
  }

  // 5. Multi-line Structured Deliverable Matrix (Must be a true recap/matrix, NOT conversational text)
  const lines = llmText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 4) {
    const hasDeliverableHeader = /^(REKAPAN|DAFTAR PESANAN|TABEL|LAPORAN|RINCIAN|INVOICE|ORDER RECAP)\b/i.test(lines[0]);
    const structuredOrderLines = lines.filter((l) =>
      /\b(TOTAL\s*=|TOTAL\s*:|\d+\s*PCS|\d+\s*RB|RP\s*[\d.,]+|\b(BCA|BRI|BNI|MANDIRI)\b|\[\s*\d+\s*PCS\s*\])\b/i.test(l)
    ).length;

    if (hasDeliverableHeader || structuredOrderLines >= 3) {
      return llmText.trim();
    }
  }

  return "";
}

export function UnifiedWorkstationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const urlChatId = searchParams.get("chatId") || "";
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem("arunaki_workspace_id");
  });

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const wsId = localStorage.getItem("arunaki_workspace_id");
    const wsChatKey = wsId ? `arunaki_active_chat_${wsId}` : "arunaki_active_chat_id";
    return (
      urlChatId ||
      localStorage.getItem(wsChatKey) ||
      localStorage.getItem("arunaki_active_chat_id") ||
      ""
    );
  });

  // Sync activeChatId with URL and localStorage
  useEffect(() => {
    if (urlChatId && urlChatId !== activeChatId) {
      setActiveChatId(urlChatId);
      localStorage.setItem("arunaki_active_chat_id", urlChatId);
      if (selectedWorkspaceId) {
        localStorage.setItem(`arunaki_active_chat_${selectedWorkspaceId}`, urlChatId);
      }
    } else if (!urlChatId && activeChatId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("chatId", activeChatId);
        return next;
      }, { replace: true });
    }
  }, [urlChatId, activeChatId, selectedWorkspaceId, setSearchParams]);

  // When workspace changes and no active chat is loaded, attempt to restore workspace's previous chat
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    const wsChatKey = `arunaki_active_chat_${selectedWorkspaceId}`;
    const savedForWs = localStorage.getItem(wsChatKey);
    if (savedForWs && savedForWs !== activeChatId) {
      setActiveChatId(savedForWs);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("chatId", savedForWs);
        return next;
      }, { replace: true });
    }
  }, [selectedWorkspaceId, activeChatId, setSearchParams]);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showSearchSectionModal, setShowSearchSectionModal] = useState(false);
  const [nativeFileNames, setNativeFileNames] = useState<string[]>([]);

  const [tabs, setTabs] = useState<CenterTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [recentCanvases, setRecentCanvases] = useState<CanvasItem[]>(() => {
    try {
      const saved = localStorage.getItem("arunaki_recent_canvases");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [inputPrompt, setInputPrompt] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const activeWorkspace = useMemo(() => {
    const match = workspaces.find((w) => w.id === selectedWorkspaceId);
    if (match) return match;
    const cachedPath = localStorage.getItem("arunaki_workspace_path");
    if (cachedPath) {
      const cachedName = cachedPath.split(/[\\/]/).filter(Boolean).pop() || "Workspace";
      return {
        id: selectedWorkspaceId || "current-ws",
        name: cachedName,
        rootPath: cachedPath,
        status: "ready",
      };
    }
    return workspaces[0] || null;
  }, [workspaces, selectedWorkspaceId]);

  const openFolderParam = searchParams.get("openFolder");
  const wsIdParam = searchParams.get("wsId");

  useEffect(() => {
    const handleWorkspaceChange = () => {
      const currentWsId = localStorage.getItem("arunaki_workspace_id");
      if (currentWsId && currentWsId !== selectedWorkspaceId) {
        setSelectedWorkspaceId(currentWsId);
      }
      refetchWorkspaces();
    };

    window.addEventListener("arunaki-workspace-change", handleWorkspaceChange);
    return () => {
      window.removeEventListener("arunaki-workspace-change", handleWorkspaceChange);
    };
  }, [selectedWorkspaceId, refetchWorkspaces]);

  useEffect(() => {
    if (wsIdParam && wsIdParam !== selectedWorkspaceId) {
      setSelectedWorkspaceId(wsIdParam);
      localStorage.setItem("arunaki_workspace_id", wsIdParam);
      refetchWorkspaces();
    }
  }, [wsIdParam, selectedWorkspaceId, refetchWorkspaces]);

  useEffect(() => {
    async function syncOpenFolder() {
      if (openFolderParam) {
        const folderName = openFolderParam.split(/[\\/]/).filter(Boolean).pop() || "workspace";
        try {
          const res = await apiFetch(`${API_BASE}/workspaces`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: folderName,
              rootPath: openFolderParam,
              businessType: "generic",
            }),
          });
          const json = await res.json();
          if (json.data?.id) {
            setSelectedWorkspaceId(json.data.id);
            localStorage.setItem("arunaki_workspace_id", json.data.id);
            localStorage.setItem("arunaki_workspace_path", openFolderParam);
            refetchWorkspaces();
          }
        } catch (err) {
          console.error("Failed to connect folder from param:", err);
        }
      }
    }
    syncOpenFolder();
  }, [openFolderParam, refetchWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0) {
      const match = workspaces.find((w) => w.id === selectedWorkspaceId);
      if (!match) {
        const first = workspaces[0];
        setSelectedWorkspaceId(first.id);
        localStorage.setItem("arunaki_workspace_id", first.id);
        if (first.rootPath) {
          localStorage.setItem("arunaki_workspace_path", first.rootPath);
        }
      } else if (match.rootPath) {
        localStorage.setItem("arunaki_workspace_path", match.rootPath);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

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

  // Extract and sync recent canvases from chat messages
  useEffect(() => {
    if (!chatMessages || chatMessages.length === 0) return;

    setRecentCanvases((prev) => {
      const items: CanvasItem[] = [...prev];
      const seenContents = new Set(items.map((i) => i.content.trim()));

      for (const msg of chatMessages) {
        if (msg.role !== "assistant" || !msg.content) continue;
        const canvasContent = extractCanvasContent(msg.content);
        if (!canvasContent || seenContents.has(canvasContent.trim())) continue;

        seenContents.add(canvasContent.trim());
        const title = extractCanvasTitle(canvasContent);
        const timeStr = msg.createdAt
          ? new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : undefined;

        items.unshift({
          id: msg.id || `canvas-${Date.now()}-${Math.random()}`,
          title,
          content: canvasContent,
          createdAt: msg.createdAt,
          timeStr,
        });
      }

      const top5 = items.slice(0, 5);
      try {
        localStorage.setItem("arunaki_recent_canvases", JSON.stringify(top5));
      } catch {}
      return top5;
    });
  }, [chatMessages]);

  const handleOpenCanvasTab = useCallback((item: CanvasItem) => {
    const canvasTabId = `tab-canvas-${item.id}`;
    setTabs((prev) => {
      const existingIdx = prev.findIndex((t) => t.id === canvasTabId);
      const newTab: CenterTab = {
        id: canvasTabId,
        type: "canvas",
        title: item.title,
        content: item.content,
        timeStr: item.timeStr,
        createdAt: item.createdAt,
      };
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = newTab;
        return copy;
      }
      return [...prev, newTab];
    });
    setActiveTabId(canvasTabId);
  }, []);

  const handleSelectWorkspace = useCallback((wsId: string | null) => {
    setSelectedWorkspaceId(wsId);
    if (wsId) {
      localStorage.setItem("arunaki_workspace_id", wsId);
    } else {
      localStorage.removeItem("arunaki_workspace_id");
      localStorage.removeItem("arunaki_workspace_path");
    }
    window.dispatchEvent(new Event("arunaki-workspace-change"));
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      setOptimisticMessages([]);
    }
  }, [selectedWorkspaceId, activeChatId, isStreaming]);

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

  // Real-time live file polling while streaming SSE is active (REMOVED: we now rely strictly on SSE events to trigger re-fetches to avoid DDOSing our own backend)

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

  const handleNewChat = useCallback(() => {
    setActiveChatId("");
    localStorage.removeItem("arunaki_active_chat_id");
    if (selectedWorkspaceId) {
      localStorage.removeItem(`arunaki_active_chat_${selectedWorkspaceId}`);
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("chatId");
      return next;
    }, { replace: true });
    setOptimisticMessages([]);
    setLiveStatus(null);
    toast.info("New conversation session ready");
  }, [selectedWorkspaceId, setSearchParams]);

  const handleCancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setLiveStatus(null);
    toast.info("Generasi dihentikan");
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

    const apiKey = import.meta.env.VITE_ARUNAKI_API_KEY || "arunaki-dev-key";
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
        setActiveChatId(chatIdToUse);
        localStorage.setItem("arunaki_active_chat_id", chatIdToUse);
        if (selectedWorkspaceId) {
          localStorage.setItem(`arunaki_active_chat_${selectedWorkspaceId}`, chatIdToUse);
        }
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("chatId", chatIdToUse);
          return next;
        }, { replace: true });
      } catch {
        setIsStreaming(false);
        setLiveStatus(null);
        toast.error("Failed to create a new conversation");
        return;
      }
    }

    let accumulatedResponseText = "";
    const streamStartTime = Date.now();
    const accumulatedSteps: StepItem[] = [];

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      await fetchEventSource(`${API_BASE}/chat/${chatIdToUse}/stream`, {
        method: "POST",
        headers: streamHeaders,
        signal: abortCtrl.signal,
        body: JSON.stringify({
          content: userText,
          reasoningEffort: reasoningEffort || undefined,
        }),
        onmessage(msg) {
          try {
            const event = JSON.parse(msg.data);
            if (event.type === "thinking") {
              const label = event.data || "Analyzing request & context";
              setLiveStatus({ type: "thinking", preview: label });
              if (!accumulatedSteps.some((s) => s.label === label)) {
                accumulatedSteps.push({
                  id: `${Date.now()}-${Math.random()}`,
                  label,
                  status: "completed",
                  iconType: "thinking",
                });
              }
            } else if (event.type === "tool_live_status" || event.type === "tool_start") {
              const toolName = event.data?.toolName || "desktop_action";
              const preview = event.data?.preview ? ` → ${event.data.preview}` : "";
              const label = `Executing: ${toolName}${preview}`;
              setLiveStatus({ type: "tool_start", ...event.data });
              if (!accumulatedSteps.some((s) => s.label === label)) {
                accumulatedSteps.push({
                  id: `${Date.now()}-${Math.random()}`,
                  label,
                  status: "completed",
                  iconType: "tool",
                  toolName,
                });
              }
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
              accumulatedResponseText += event.data;
              setLiveStatus({ type: "text_delta", preview: "Generating response" });
              setOptimisticMessages((prev) => {
                const exists = prev.some((m) => m.id === assistantMessageId);
                if (!exists) {
                  return [
                    ...prev,
                    {
                      id: assistantMessageId,
                      role: "assistant",
                      content: event.data,
                      createdAt: new Date().toISOString(),
                      executionSteps: accumulatedSteps.length > 0 ? [...accumulatedSteps] : undefined,
                    },
                  ];
                }
                return prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: m.content + event.data,
                        executionSteps: accumulatedSteps.length > 0 ? [...accumulatedSteps] : m.executionSteps,
                      }
                    : m
                );
              });
              const canvasText = extractCanvasContent(accumulatedResponseText);
              if (canvasText) {
                const canvasTabId = "tab-canvas-active";
                const canvasTitle = extractCanvasTitle(canvasText);
                const currentTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                const currentCreatedAt = new Date().toISOString();
                setTabs((prev) => {
                  const existingIdx = prev.findIndex((t) => t.id === canvasTabId);
                  const newTab: CenterTab = {
                    id: canvasTabId,
                    type: "canvas",
                    title: canvasTitle,
                    content: canvasText,
                    timeStr: currentTimeStr,
                    createdAt: currentCreatedAt,
                  };
                  if (existingIdx >= 0) {
                    const copy = [...prev];
                    copy[existingIdx] = newTab;
                    return copy;
                  }
                  return [...prev, newTab];
                });
                setActiveTabId(canvasTabId);
              }
            } else if (event.type === "done") {
              setIsStreaming(false);
              setLiveStatus(null);
              const elapsedSec = Math.max(1, Math.round((Date.now() - streamStartTime) / 1000));

              setOptimisticMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: accumulatedResponseText || m.content,
                        executionSteps: accumulatedSteps.length > 0 ? [...accumulatedSteps] : undefined,
                        thoughtSec: elapsedSec,
                      }
                    : m
                )
              );

              // Dynamic Desktop Notification
              try {
                const isNotifEnabled = localStorage.getItem("arunaki_pref_desktop_notification") !== "false";
                const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
                if (isNotifEnabled && desktop?.notify) {
                  const toolsCount = event.data?.toolOutputs?.length || 0;
                  const notifBody = toolsCount > 0
                    ? `Executed ${toolsCount} document task${toolsCount > 1 ? "s" : ""} successfully.`
                    : "Document response generated.";
                  desktop.notify({
                    title: "Arunaki Workstation",
                    body: notifBody,
                  });
                }
              } catch {
                // Ignore desktop notification error
              }

              const canvasText = extractCanvasContent(accumulatedResponseText || event.data?.content || "");
              if (canvasText) {
                const canvasTabId = "tab-canvas-active";
                const canvasTitle = extractCanvasTitle(canvasText);
                const currentTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                const currentCreatedAt = new Date().toISOString();
                setTabs((prev) => {
                  const existingIdx = prev.findIndex((t) => t.id === canvasTabId);
                  const newTab: CenterTab = {
                    id: canvasTabId,
                    type: "canvas",
                    title: canvasTitle,
                    content: canvasText,
                    timeStr: currentTimeStr,
                    createdAt: currentCreatedAt,
                  };
                  if (existingIdx >= 0) {
                    const copy = [...prev];
                    copy[existingIdx] = newTab;
                    return copy;
                  }
                  return [...prev, newTab];
                });
                setActiveTabId(canvasTabId);

                // Update recent canvases
                setRecentCanvases((prev) => {
                  const filtered = prev.filter((i) => i.content.trim() !== canvasText.trim());
                  const top5 = [
                    {
                      id: `canvas-${Date.now()}`,
                      title: canvasTitle,
                      content: canvasText,
                      createdAt: currentCreatedAt,
                      timeStr: currentTimeStr,
                    },
                    ...filtered,
                  ].slice(0, 5);
                  try {
                    localStorage.setItem("arunaki_recent_canvases", JSON.stringify(top5));
                  } catch {}
                  return top5;
                });
              }
              queryClient.invalidateQueries({ queryKey: ["chat-messages", chatIdToUse] }).then(() => {
                setOptimisticMessages([]);
              });
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
    <div className="flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden select-none transition-colors duration-150">
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
          recentCanvases={recentCanvases}
          onOpenCanvasTab={handleOpenCanvasTab}
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
          onSearchSection={() => setShowSearchSectionModal(true)}
          reasoningEffort={reasoningEffort}
          setReasoningEffort={setReasoningEffort}
          onNewChat={handleNewChat}
          onCancelStream={handleCancelStream}
        />
      </div>

      <ConnectFolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        workspaces={workspaces}
        onSelectWorkspace={handleSelectWorkspace}
        onRefreshWorkspaces={refetchWorkspaces}
      />

      <SearchSectionModal
        isOpen={showSearchSectionModal}
        onClose={() => setShowSearchSectionModal(false)}
        onSelectSession={(chatId) => setSearchParams({ chatId })}
        workspaceId={selectedWorkspaceId}
      />
    </div>
  );
}
