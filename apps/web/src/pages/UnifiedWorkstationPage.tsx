import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationCenterPanel, CenterTab } from "../components/workstation/WorkstationCenterPanel";
import { WorkstationRightChat } from "../components/workstation/WorkstationRightChat";
import { ConnectFolderModal } from "../components/workstation/ConnectFolderModal";
import { SearchSectionModal } from "../components/workstation/SearchSectionModal";
import { LiveStatusData, StepItem } from "../components/workstation/LiveExecutionBadge";
import {
  createSession,
  sendPrompt,
  subscribeEvents,
  mapEngineEvent,
  engineFetch,
  getMessages,
} from "../lib/engine";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  executionSteps?: StepItem[];
  thoughtSec?: number;
  metadata?: string | Record<string, any>;
  reasoning?: string;
}

interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}

export interface CanvasItem {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  timeStr?: string;
}

const DOCUMENT_EXTENSIONS = new Set(["xlsx", "xls", "xlsm", "docx", "doc", "pptx", "ppt", "csv", "pdf"]);

function isDocumentPath(p: string): boolean {
  const ext = (p.split(".").pop() || "").toLowerCase();
  return DOCUMENT_EXTENSIONS.has(ext);
}

function extractCanvasTitle(content: string): string {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "Tabel Data";
  // If it's a markdown table, use table headers as title
  if (lines[0].startsWith("|")) {
    const cells = lines[0].split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length > 0) {
      return `Tabel: ${cells.slice(0, 2).join(" / ")}`;
    }
    return "Tabel Data";
  }
  const firstLine = lines[0].replace(/^#+\s*/, "").replace(/[`*|]/g, "").trim();
  if (firstLine.length > 0 && firstLine.length <= 36) return firstLine;
  if (firstLine.length > 36) return firstLine.slice(0, 34) + "...";
  return "Data Canvas";
}

function extractCanvasContent(llmText: string): string {
  if (!llmText) return "";

  // 1. Explicit [CANVAS]...[/CANVAS] block
  const completeMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i);
  if (completeMatch?.[1]?.trim()) return completeMatch[1].trim();

  // 2. Real-time streaming [CANVAS]...
  const streamMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*)$/i);
  if (streamMatch?.[1]?.trim()) return streamMatch[1].trim();

  // 3. Explicit deliverable/data codeblocks (```deliverable, ```canvas, ```csv, ```table, ```excel)
  const fencedMatch = llmText.match(/```(?:deliverable|canvas|document|csv|table|excel)\s*\n([\s\S]*?)\n```/i);
  if (fencedMatch?.[1]?.trim() && fencedMatch[1].trim().length > 20) {
    return fencedMatch[1].trim();
  }

  // 4. Real Markdown Table (Must have proper table headers and data rows)
  // ONLY extracts the table itself, completely stripping out any conversation before or after it!
  if (llmText.includes("|") && (llmText.includes("---") || llmText.includes("-|-"))) {
    const normalized = llmText.replace(/\|\|\s*\|/g, "|\n|");
    const tableMatch = normalized.match(/(\|.+?\|\r?\n\|[-:\s|]+\|\r?\n(?:\|.+?\|\r?\n?)+)/);
    if (tableMatch?.[0]?.trim()) {
      return tableMatch[0].trim();
    }
  }

  // Conversational text, chit-chat, and bullet checklists stay in chat, never converted to Canvas
  return "";
}

// Map engine session messages (/api/session/:id/message) into the chat Message shape.
function mapEngineMessages(raw: any[]): Message[] {
  return raw.map((msg, idx) => {
    const role: "user" | "assistant" = msg.type === "user" || msg.role === "user" ? "user" : "assistant";
    let content = "";
    let reasoning = "";

    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (typeof msg.text === "string") {
      content = msg.text;
    } else if (Array.isArray(msg.content)) {
      const reasoningParts = msg.content.filter((p: any) => p && p.type === "reasoning");
      if (reasoningParts.length > 0) {
        reasoning = reasoningParts.map((p: any) => (p && typeof p.text === "string" ? p.text : "")).join("\n\n");
      }
      const textParts = msg.content.filter((p: any) => p && p.type !== "reasoning");
      content = (textParts.length > 0 ? textParts : msg.content)
        .filter((p: any) => p && p.type !== "reasoning")
        .map((p: any) => (p && typeof p.text === "string" ? p.text : ""))
        .join("");
    } else if (Array.isArray(msg.parts)) {
      const reasoningParts = msg.parts.filter((p: any) => p && p.type === "reasoning");
      if (reasoningParts.length > 0) {
        reasoning = reasoningParts.map((p: any) => (p && typeof p.text === "string" ? p.text : "")).join("\n\n");
      }
      const textParts = msg.parts.filter((p: any) => p && p.type !== "reasoning");
      content = (textParts.length > 0 ? textParts : msg.parts)
        .filter((p: any) => p && p.type !== "reasoning")
        .map((p: any) => (p && typeof p.text === "string" ? p.text : ""))
        .join("");
    }
    if (!content && msg.error?.message) {
      content = `⚠️ ${msg.error.message}`;
    }
    return {
      id: msg.id || `${role}-${idx}-${Date.now()}`,
      role,
      content,
      reasoning: reasoning || undefined,
      createdAt: msg.createdAt || msg.time?.created || undefined,
    };
  });
}

export function UnifiedWorkstationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const urlChatId = searchParams.get("chatId") || "";

  // Active folder: the single project folder the agent operates in (like cwd in VSCode).
  // No Workspace entity — the folder path IS the unit.
  const [activeFolder, setActiveFolder] = useState<string>(() => {
    return (
      searchParams.get("folder") ||
      ""
    );
  });

  const activeFolderName = useMemo(() => {
    if (!activeFolder) return "";
    return activeFolder.split(/[\\/]/).filter(Boolean).pop() || activeFolder;
  }, [activeFolder]);

  // Components still expect an "activeWorkspace" shape; map the active folder onto it.
  const activeWorkspace = useMemo(
    () =>
      activeFolder
        ? { id: "active-folder", name: activeFolderName, rootPath: activeFolder, status: "ready" }
        : null,
    [activeFolder, activeFolderName]
  );

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const raw = urlChatId || localStorage.getItem("arunaki_active_chat_id") || "";
    // Arunaki engine session IDs must start with 'ses_'
    return raw.startsWith("ses_") ? raw : "";
  });

  const isCreatingNewChat = useRef(false);

  // Persist active folder whenever it changes
  useEffect(() => {
    if (activeFolder) {
      localStorage.setItem("arunaki_active_folder", activeFolder);
    }
  }, [activeFolder]);

  // Sync activeChatId with URL and localStorage
  useEffect(() => {
    if (isCreatingNewChat.current) {
      if (!urlChatId) {
        // Navigation completed, URL is now clear. Resume normal sync.
        isCreatingNewChat.current = false;
      }
      return;
    }

    if (urlChatId && urlChatId !== activeChatId) {
      setActiveChatId(urlChatId);
      localStorage.setItem("arunaki_active_chat_id", urlChatId);
    } else if (!urlChatId && activeChatId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("chatId", activeChatId);
        return next;
      }, { replace: true });
    }
  }, [urlChatId, activeChatId, setSearchParams]);

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

  const [reasoningEffort, setReasoningEffort] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const producedFilesRef = useRef<string[]>([]);
  const openingTabsRef = useRef<Set<string>>(new Set());

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

  const openFolderParam = searchParams.get("openFolder");

  // Open a folder (from Electron dialog or URL param) → becomes the active project folder.
  const openFolder = useCallback((folderPath: string) => {
    setActiveFolder(folderPath);
    setActiveChatId("");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("folder", folderPath);
      return next;
    }, { replace: true });
    window.dispatchEvent(new Event("arunaki-folder-change"));
  }, [setActiveFolder, setSearchParams]);

  useEffect(() => {
    if (openFolderParam && openFolderParam !== activeFolder) {
      openFolder(openFolderParam);
    }
  }, [openFolderParam, activeFolder, openFolder]);

  // 1. List files of the active folder via engine /api/file
  const { data: workspaceFiles = [], refetch: refetchFiles } = useQuery<WorkspaceFile[]>({
    queryKey: ["folder-files", activeFolder],
    queryFn: async () => {
      if (!activeFolder) return [];
      try {
        const res = await engineFetch(`/api/file?directory=${encodeURIComponent(activeFolder)}&path=${encodeURIComponent(activeFolder)}`);
        const json = await res.json();
        const entries: Array<{ name: string; path: string; type: string }> = json.data || json || [];
        return entries
          .filter((e) => e && e.type !== "directory")
          .map((e) => ({
            id: e.path,
            name: e.name,
            path: e.path,
            type: "file",
            size: 0,
          }));
      } catch {
        return [];
      }
    },
    enabled: !!activeFolder,
  });

  const mentionFiles = useMemo(
    () =>
      Array.from(
        new Set([...workspaceFiles.map((f) => f.name), ...nativeFileNames])
      ).map((name) => ({ name })),
    [workspaceFiles, nativeFileNames]
  );

  // 3. Fetch Chat Messages from engine
  const { data: chatMessages = [] } = useQuery<Message[]>({
    queryKey: ["chat-messages", activeChatId],
    queryFn: async () => {
      if (!activeChatId) return [];
      try {
        const raw = await getMessages(activeChatId);
        return mapEngineMessages(raw || []);
      } catch {
        return [];
      }
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

  // Auto-deduplicate tabs by title/path to purge any duplicate tabs from state
  useEffect(() => {
    setTabs((prev) => {
      const seen = new Set<string>();
      const unique = prev.filter((t) => {
        const key = t.path || t.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return unique.length !== prev.length ? unique : prev;
    });
  }, []);

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

  // Clear optimistic messages only on explicit folder/chat navigation changes.
  // Do NOT clear when isStreaming changes — the "done" event handler takes care
  // of clearing optimistic messages *after* invalidateQueries finishes, so
  // persisted messages are already in the cache and no blank flash occurs.
  const prevChatIdRef = useRef(activeChatId);
  const prevFolderRef = useRef(activeFolder);
  useEffect(() => {
    const chatChanged = prevChatIdRef.current !== activeChatId;
    const folderChanged = prevFolderRef.current !== activeFolder;
    prevChatIdRef.current = activeChatId;
    prevFolderRef.current = activeFolder;

    // Only clear if navigation actually changed AND we are not in the middle of a stream.
    // During streaming, createSession sets activeChatId — we must NOT wipe optimistic in that case.
    if ((chatChanged || folderChanged) && !isStreaming) {
      setOptimisticMessages([]);
    }
  }, [activeFolder, activeChatId, isStreaming]);

  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
  }, [chatMessages, optimisticMessages, isStreaming]);

  const handleOpenFileTab = useCallback(
    async (filePath: string, fileName: string, content?: string, silent?: boolean) => {
      const tabId = `file-${fileName}`;
      const existing = tabs.find((t) => t.id === tabId || t.title === fileName);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      if (openingTabsRef.current.has(tabId) || openingTabsRef.current.has(fileName)) {
        return;
      }
      openingTabsRef.current.add(tabId);
      openingTabsRef.current.add(fileName);

      try {
        let fileContent = content || "";
        const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
        if (!fileContent && desktop?.readFile) {
          const fullPath = (filePath.includes(":") || filePath.startsWith("/") || filePath.startsWith("\\"))
            ? filePath
            : `${activeFolder}\\${filePath}`;
          try {
            const res = await desktop.readFile(fullPath);
            if (typeof res?.content === "string") {
              fileContent = res.content;
            }
          } catch {}
        }

        if (!fileContent) {
          try {
            const res = await engineFetch(
              `/api/file/content?directory=${encodeURIComponent(activeFolder || "")}&path=${encodeURIComponent(filePath)}`
            );
            if (res.ok) {
              const json = await res.json();
              fileContent =
                json.data?.content ||
                (typeof json.data === "string" ? json.data : "");
            }
          } catch {}
        }

        const newTab: CenterTab = {
          id: tabId,
          type: "file",
          title: fileName,
          path: filePath,
          fileType: fileName.split(".").pop() || "txt",
          content: fileContent || "Empty document...",
        };

        setTabs((prev) => {
          if (prev.some((t) => t.id === tabId || t.title === fileName || (filePath && t.path === filePath))) {
            return prev;
          }
          return [...prev, newTab];
        });
        setActiveTabId(tabId);
      } catch {
        if (!silent) {
          toast.error(`Failed to read file ${fileName}`);
        }
      } finally {
        openingTabsRef.current.delete(tabId);
        openingTabsRef.current.delete(fileName);
      }
    },
    [tabs, activeFolder]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const targetTab = prev.find((t) => t.id === tabId);
        const targetTitle = targetTab?.title;
        // Clean up both the tab and any accidental duplicates with the same title
        const next = prev.filter((t) => t.id !== tabId && (!targetTitle || t.title !== targetTitle));
        if (activeTabId === tabId || (targetTitle && prev.find((t) => t.id === activeTabId)?.title === targetTitle)) {
          setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const reloadOpenTabsContent = useCallback(async () => {
    if (!activeFolder) return;
    try {
      setTabs((currentTabs) => {
        const fileTabs = currentTabs.filter((t) => t.type === "file");
        if (fileTabs.length === 0) return currentTabs;

        const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;

        Promise.all(
          fileTabs.map(async (tab) => {
            if (!tab.path && !tab.title) return null;
            const filePath = tab.path || tab.title;
            let freshContent: string | null = null;

            if (desktop?.readFile) {
              const fullPath = (filePath.includes(":") || filePath.startsWith("/") || filePath.startsWith("\\"))
                ? filePath
                : `${activeFolder}\\${filePath}`;
              try {
                const res = await desktop.readFile(fullPath);
                if (typeof res?.content === "string") {
                  freshContent = res.content;
                }
              } catch {}
            }

            if (freshContent === null) {
              try {
                const contentRes = await engineFetch(
                  `/api/file/content?directory=${encodeURIComponent(activeFolder)}&path=${encodeURIComponent(filePath)}`
                );
                if (contentRes.ok) {
                  const contentJson = await contentRes.json();
                  freshContent =
                    typeof contentJson.data?.content === "string"
                      ? contentJson.data.content
                      : typeof contentJson.data === "string"
                      ? contentJson.data
                      : null;
                }
              } catch {}
            }

            if (freshContent !== null) {
              return { tabId: tab.id, content: freshContent };
            }
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
  }, [activeFolder]);

  const handleUpdateTabContent = useCallback((tabId: string, newContent: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, content: newContent } : t))
    );
  }, []);

  const handleSaveFileTab = useCallback(
    async (tabId: string, newContent: string) => {
      const targetTab = tabs.find((t) => t.id === tabId);
      if (!targetTab) return;
      const filePath = targetTab.path || targetTab.title;
      const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
      if (desktop?.writeFile) {
        const fullPath = (filePath.includes(":") || filePath.startsWith("/") || filePath.startsWith("\\"))
          ? filePath
          : `${activeFolder}\\${filePath}`;
        try {
          const res = await desktop.writeFile(fullPath, newContent);
          if (res?.success) {
            toast.success(`Saved ${targetTab.title}`);
            setTabs((prev) =>
              prev.map((t) => (t.id === tabId ? { ...t, content: newContent } : t))
            );
            refetchFiles();
            return;
          } else if (res?.error) {
            toast.error(`Save failed: ${res.error}`);
            return;
          }
        } catch (err: any) {
          toast.error(`Failed to save: ${err?.message || err}`);
          return;
        }
      } else {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, content: newContent } : t))
        );
        toast.info("Content updated locally");
      }
    },
    [tabs, activeFolder, refetchFiles]
  );

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
    isCreatingNewChat.current = true;
    setActiveChatId("");
    localStorage.removeItem("arunaki_active_chat_id");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("chatId");
      return next;
    }, { replace: true });
    setOptimisticMessages([]);
    setLiveStatus(null);
    toast.info("New conversation session ready");
  }, [setSearchParams]);

  const handleCancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setLiveStatus(null);
    toast.info("Generasi dihentikan");
  }, []);

  const handleSendMessage = async (textToSend: string) => {
    const userText = textToSend ? textToSend.trim() : "";
    if (!userText) return;

    // If currently streaming another turn, QUEUE the message (Google Antigravity pattern)!
    if (isStreaming) {
      setQueuedPrompts((prev) => [...prev, userText]);
      toast.info("Pesan masuk ke antrian dan akan diproses otomatis setelah ini");
      return;
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
    producedFilesRef.current = [];
    setLiveStatus({ type: "thinking", preview: "Analyzing request & context" });

    let chatIdToUse = activeChatId;
    if (!chatIdToUse || !chatIdToUse.startsWith("ses_")) {
      try {
        const session = await createSession({
          directory: activeFolder || undefined,
        });
        chatIdToUse = session.id;
        setActiveChatId(chatIdToUse);
        localStorage.setItem("arunaki_active_chat_id", chatIdToUse);
        if (activeFolder) {
          localStorage.setItem("arunaki_active_folder", activeFolder);
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
      // Subscribe to engine events BEFORE sending prompt to capture early stream tokens
      subscribeEvents((rawEvent) => {
        const event = mapEngineEvent(rawEvent, chatIdToUse);
        if (!event) return;
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
                  handleOpenFileTab(targetPath, fileName, undefined, true);
                }
                if (isDocumentPath(targetPath) && !producedFilesRef.current.includes(targetPath)) {
                  producedFilesRef.current.push(targetPath);
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

              // Desktop Notification: only notify if user has minimized or switched away from the app
              try {
                const isNotifEnabled = localStorage.getItem("arunaki_pref_desktop_notification") !== "false";
                const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
                const isWindowHidden = typeof document !== "undefined" && (!document.hasFocus() || document.hidden);
                if (isNotifEnabled && desktop?.notify && isWindowHidden) {
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

                // Auto-backup + auto-open produced documents (Desktop Automation & Behavior)
                const autoOpenExcel = localStorage.getItem("arunaki_pref_auto_open_excel") === "true";
                const autoBackup = localStorage.getItem("arunaki_pref_auto_backup") !== "false";
                const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
                const toolsCount = event.data?.toolOutputs?.length || 0;
                const produced = producedFilesRef.current.filter(isDocumentPath);
                if (autoBackup && toolsCount > 0) {
                  if (desktop?.backupFolder) {
                    desktop.backupFolder().then((r: any) => {
                      if (r?.success) toast.success("Workspace backed up automatically");
                      else if (r?.error) toast.error(`Auto-backup failed: ${r.error}`);
                    }).catch(() => {});
                  } else if (!desktop) {
                    toast.info("Auto-backup requires the desktop app");
                  }
                }
                if (autoOpenExcel && produced.length > 0) {
                  if (desktop?.openPath) {
                    for (const doc of produced) {
                      try {
                        if ((/\.(xlsx|xls|xlsm)$/i).test(doc) && desktop.openExcelNative) {
                          desktop.openExcelNative(doc);
                        } else {
                          desktop.openPath(doc);
                        }
                      } catch {
                        // Ignore per-file open failure
                      }
                    }
                  } else if (!desktop) {
                    toast.info("Auto-open documents requires the desktop app");
                  }
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
              const errorMsg = event.data?.message || "An error occurred.";
              toast.error(errorMsg);
              setOptimisticMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: `⚠️ **Error:** ${errorMsg}` }
                    : m
                )
              );
              // Refetch persisted messages so user message stays visible after optimistic clear
              queryClient.invalidateQueries({ queryKey: ["chat-messages", chatIdToUse] }).then(() => {
                setOptimisticMessages([]);
              });
              processNextQueuedPrompt();
            }
          }, abortCtrl.signal);

        // Send prompt to engine, carrying the reasoning variant when set
        try {
          await sendPrompt(chatIdToUse, userText, { variant: reasoningEffort || undefined });
        } catch (promptErr: any) {
          if (promptErr?.message?.includes("400") || promptErr?.message?.includes("404")) {
            console.warn("[UnifiedWorkstation] Session prompt failed, auto-recovering with fresh session...", promptErr);
            const freshSession = await createSession({ directory: activeFolder || undefined });
            chatIdToUse = freshSession.id;
            setActiveChatId(chatIdToUse);
            localStorage.setItem("arunaki_active_chat_id", chatIdToUse);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("chatId", chatIdToUse);
              return next;
            }, { replace: true });
            await sendPrompt(chatIdToUse, userText, { variant: reasoningEffort || undefined });
          } else {
            throw promptErr;
          }
        }
    } catch (err: any) {
      console.error("[UnifiedWorkstation] sendPrompt failed:", err);
      toast.error(`Error sending message: ${err?.message || err}`);
      setIsStreaming(false);
      setLiveStatus(null);
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
          onClose={() => setLeftCollapsed(true)}
          activeWorkspace={activeWorkspace}
          workspaceFiles={workspaceFiles}
          onOpenFileTab={handleOpenFileTab}
          onOpenFolderModal={() => setShowFolderModal(true)}
          onCloseFolder={() => {
            setActiveFolder("");
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete("folder");
              return next;
            }, { replace: true });
            toast.info("Folder closed. Agent is now in sandbox mode.");
          }}
          width="var(--left-panel-width)"
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
          activeFolder={activeFolder}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
          onUpdateTabContent={handleUpdateTabContent}
          onSaveTabContent={handleSaveFileTab}
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
        onOpenFolder={openFolder}
      />

      <SearchSectionModal
        isOpen={showSearchSectionModal}
        onClose={() => setShowSearchSectionModal(false)}
        onSelectSession={(chatId) => setSearchParams({ chatId })}
      />
    </div>
  );
}
