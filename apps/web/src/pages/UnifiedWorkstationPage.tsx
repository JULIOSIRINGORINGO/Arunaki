import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationCenterPanel } from "../components/workstation/WorkstationCenterPanel";
import { WorkstationRightChat } from "../components/workstation/WorkstationRightChat";
import { ConnectFolderModal } from "../components/workstation/ConnectFolderModal";
import { SearchSectionModal } from "../components/workstation/SearchSectionModal";
import { useTabs } from "../components/workstation/tabs/useTabs";
import { useWorkstationChat } from "../components/workstation/chat/useWorkstationChat";
import { WorkspaceFile } from "../components/workstation/chat/types";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { engineFetch } from "../lib/engine";

export function UnifiedWorkstationPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isWorkstationRoute =
    location.pathname === "/" || location.pathname.startsWith("/workspace");

  const urlChatId = searchParams.get("chatId") || "";

  // 1. Active folder management (agent-per-folder architecture)
  const [activeFolder, setActiveFolder] = useState<string>(() => {
    return (
      searchParams.get("folder") ||
      localStorage.getItem("arunaki_active_folder") ||
      ""
    );
  });

  const activeFolderName = useMemo(() => {
    if (!activeFolder) return "";
    return activeFolder.split(/[\\/]/).filter(Boolean).pop() || activeFolder;
  }, [activeFolder]);

  const activeWorkspace = useMemo(
    () =>
      activeFolder
        ? { id: "active-folder", name: activeFolderName, rootPath: activeFolder, status: "ready" }
        : null,
    [activeFolder, activeFolderName]
  );

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const raw = urlChatId || localStorage.getItem("arunaki_active_chat_id") || "";
    return raw.startsWith("ses_") ? raw : "";
  });

  // Sync active folder with localStorage and URL (only when on workstation route)
  useEffect(() => {
    if (!isWorkstationRoute) return;
    if (activeFolder) {
      localStorage.setItem("arunaki_active_folder", activeFolder);
      if (searchParams.get("folder") !== activeFolder) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("folder", activeFolder);
          return next;
        }, { replace: true });
      }
    }
  }, [isWorkstationRoute, activeFolder, searchParams, setSearchParams]);

  // Sync external folder changes (e.g. from topbar)
  useEffect(() => {
    function handleFolderChange() {
      const saved = localStorage.getItem("arunaki_active_folder");
      if (saved && saved !== activeFolder) {
        setActiveFolder(saved);
        if (isWorkstationRoute) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("folder", saved);
            return next;
          }, { replace: true });
        }
      }
    }
    window.addEventListener("arunaki-folder-change", handleFolderChange);
    return () => window.removeEventListener("arunaki-folder-change", handleFolderChange);
  }, [isWorkstationRoute, activeFolder, setSearchParams]);

  // Sync external session changes (e.g. from HistoryPage navigation)
  useEffect(() => {
    function handleSessionChange() {
      const saved = localStorage.getItem("arunaki_active_chat_id");
      if (saved && saved.startsWith("ses_") && saved !== activeChatId) {
        setActiveChatId(saved);
        if (isWorkstationRoute && searchParams.get("chatId") !== saved) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("chatId", saved);
            return next;
          }, { replace: true });
        }
      }
    }
    window.addEventListener("arunaki-session-change", handleSessionChange);
    return () => window.removeEventListener("arunaki-session-change", handleSessionChange);
  }, [isWorkstationRoute, activeChatId, searchParams, setSearchParams]);

  // Sync incoming urlChatId into activeChatId
  useEffect(() => {
    if (!isWorkstationRoute) return;
    if (urlChatId && urlChatId.startsWith("ses_") && urlChatId !== activeChatId) {
      setActiveChatId(urlChatId);
      localStorage.setItem("arunaki_active_chat_id", urlChatId);
    }
  }, [isWorkstationRoute, urlChatId, activeChatId]);

  // Sync internal activeChatId state changes into URL searchParams
  useEffect(() => {
    if (!isWorkstationRoute) return;
    if (activeChatId && activeChatId.startsWith("ses_")) {
      localStorage.setItem("arunaki_active_chat_id", activeChatId);
      if (searchParams.get("chatId") !== activeChatId) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("chatId", activeChatId);
          return next;
        }, { replace: true });
      }
    }
  }, [isWorkstationRoute, activeChatId, searchParams, setSearchParams]);

  const openFolderParam = searchParams.get("openFolder");
  const openFolder = useCallback((folderPath: string) => {
    setActiveFolder(folderPath);
    setActiveChatId("");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("folder", folderPath);
      next.delete("chatId");
      return next;
    }, { replace: true });
    window.dispatchEvent(new Event("arunaki-folder-change"));
  }, [setActiveFolder, setSearchParams]);

  useEffect(() => {
    if (openFolderParam && openFolderParam !== activeFolder) {
      openFolder(openFolderParam);
    }
  }, [openFolderParam, activeFolder, openFolder]);

  // 2. Folder files query
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

  const [nativeFileNames, setNativeFileNames] = useState<string[]>([]);
  const mentionFiles = useMemo(
    () =>
      Array.from(
        new Set([...workspaceFiles.map((f) => f.name), ...nativeFileNames])
      ).map((name) => ({ name })),
    [workspaceFiles, nativeFileNames]
  );

  // 3. Modular domain hooks
  const tabs = useTabs({ activeFolder, refetchFiles });

  const chat = useWorkstationChat({
    activeFolder,
    activeChatId,
    setActiveChatId,
    refetchFiles,
    reloadOpenTabsContent: tabs.reloadOpenTabsContent,
    onOpenFileTab: tabs.handleOpenFileTab,
    upsertCanvasTab: tabs.upsertCanvasTab,
  });

  // 4. Panel UI layout & resize controls
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showSearchSectionModal, setShowSearchSectionModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Listen for top menubar global events
  useEffect(() => {
    const handleNewChatEvent = () => chat.handleNewChat();
    const handleSaveFileEvent = () => {
      const activeTab = tabs.tabs.find((t) => t.id === tabs.activeTabId);
      if (activeTab && activeTab.type === "file") {
        tabs.handleSaveFileTab(activeTab.id, activeTab.content || "");
      }
    };
    const handleSearchSessionEvent = () => setShowSearchSectionModal(true);
    const handleToggleExplorerEvent = () => setLeftCollapsed((prev) => !prev);
    const handleToggleChatEvent = () => setRightCollapsed((prev) => !prev);

    window.addEventListener("arunaki-new-chat", handleNewChatEvent);
    window.addEventListener("arunaki-save-file", handleSaveFileEvent);
    window.addEventListener("arunaki-search-session", handleSearchSessionEvent);
    window.addEventListener("arunaki-toggle-explorer", handleToggleExplorerEvent);
    window.addEventListener("arunaki-toggle-chat", handleToggleChatEvent);

    return () => {
      window.removeEventListener("arunaki-new-chat", handleNewChatEvent);
      window.removeEventListener("arunaki-save-file", handleSaveFileEvent);
      window.removeEventListener("arunaki-search-session", handleSearchSessionEvent);
      window.removeEventListener("arunaki-toggle-explorer", handleToggleExplorerEvent);
      window.removeEventListener("arunaki-toggle-chat", handleToggleChatEvent);
    };
  }, [chat.handleNewChat, tabs.handleSaveFileTab, tabs.tabs, tabs.activeTabId]);

  // Shortcuts: Ctrl+B (Explorer), Ctrl+J (Chat) (VS Code parity)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (!isInput && (e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          setLeftCollapsed((prev) => !prev);
        } else if (e.key.toLowerCase() === "j") {
          e.preventDefault();
          setRightCollapsed((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
          onToggle={() => setLeftCollapsed((prev) => !prev)}
          activeWorkspace={activeWorkspace}
          workspaceFiles={workspaceFiles}
          onOpenFileTab={tabs.handleOpenFileTab}
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
          recentCanvases={tabs.recentCanvases}
          onOpenCanvasTab={tabs.handleOpenCanvasTab}
        />

        {!leftCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-[var(--border-strong)] transition-colors"
            onMouseDown={(e) => startDrag("left", e)}
          />
        )}

        <WorkstationCenterPanel
          tabs={tabs.tabs}
          activeTabId={tabs.activeTabId}
          activeFolder={activeFolder}
          onSelectTab={tabs.setActiveTabId}
          onCloseTab={tabs.handleCloseTab}
          onUpdateTabContent={tabs.handleUpdateTabContent}
          onSaveTabContent={tabs.handleSaveFileTab}
        />

        {!rightCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-[var(--border-strong)] transition-colors"
            onMouseDown={(e) => startDrag("right", e)}
          />
        )}

        <ErrorBoundary fullScreen={false} fallbackTitle="Chat panel encountered an error">
          <WorkstationRightChat
            activeChatId={activeChatId}
            collapsed={rightCollapsed}
            onClose={() => setRightCollapsed(!rightCollapsed)}
            chatMessages={chat.chatMessages}
            optimisticMessages={chat.optimisticMessages}
            liveStatus={chat.liveStatus}
            messagesEndRef={chat.messagesEndRef}
            activeWorkspace={activeWorkspace}
            isStreaming={chat.isStreaming}
            onSendMessage={chat.handleSendMessage}
            width="var(--right-panel-width, 320px)"
            files={mentionFiles}
            queuedPrompts={chat.queuedPrompts}
            onRemoveQueuedPrompt={chat.handleRemoveQueuedPrompt}
            onSearchSection={() => setShowSearchSectionModal(true)}
            reasoningEffort={chat.reasoningEffort}
            setReasoningEffort={chat.setReasoningEffort}
            onNewChat={chat.handleNewChat}
            onCancelStream={chat.handleCancelStream}
          />
        </ErrorBoundary>
      </div>

      <ConnectFolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onOpenFolder={openFolder}
      />

      <SearchSectionModal
        isOpen={showSearchSectionModal}
        onClose={() => setShowSearchSectionModal(false)}
        onSelectSession={(chatId) => {
          setActiveChatId(chatId);
          localStorage.setItem("arunaki_active_chat_id", chatId);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("chatId", chatId);
            return next;
          }, { replace: true });
        }}
      />
    </div>
  );
}
