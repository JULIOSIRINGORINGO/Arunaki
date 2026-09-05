import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { engineFetch } from "../lib/engine";

export function UnifiedWorkstationPage() {
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Sync active folder with localStorage and URL
  useEffect(() => {
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
  }, [activeFolder, searchParams, setSearchParams]);

  // Sync external folder changes (e.g. from topbar)
  useEffect(() => {
    function handleFolderChange() {
      const saved = localStorage.getItem("arunaki_active_folder");
      if (saved && saved !== activeFolder) {
        setActiveFolder(saved);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("folder", saved);
          return next;
        }, { replace: true });
      }
    }
    window.addEventListener("arunaki-folder-change", handleFolderChange);
    return () => window.removeEventListener("arunaki-folder-change", handleFolderChange);
  }, [activeFolder, setSearchParams]);

  // Sync activeChatId with URL and localStorage
  useEffect(() => {
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

  const openFolderParam = searchParams.get("openFolder");
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

        <div
          className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-blue-500/50 transition-colors"
          onMouseDown={(e) => startDrag("left", e)}
        />

        <WorkstationCenterPanel
          tabs={tabs.tabs}
          activeTabId={tabs.activeTabId}
          activeFolder={activeFolder}
          onSelectTab={tabs.setActiveTabId}
          onCloseTab={tabs.handleCloseTab}
          onUpdateTabContent={tabs.handleUpdateTabContent}
          onSaveTabContent={tabs.handleSaveFileTab}
        />

        <div
          className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-blue-500/50 transition-colors"
          onMouseDown={(e) => startDrag("right", e)}
        />

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
