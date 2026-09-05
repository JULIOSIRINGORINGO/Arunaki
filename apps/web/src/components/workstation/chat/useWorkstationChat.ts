import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Message } from "./types";
import { mapEngineMessages } from "./mapper";
import { LiveStatusData, StepItem } from "../LiveExecutionBadge";
import { extractCanvasContent } from "../canvas/canvas";
import { isDocumentPath } from "../tabs/utils";
import {
  createSession,
  sendPrompt,
  subscribeEvents,
  mapEngineEvent,
  getMessages,
} from "../../../lib/engine";

interface UseWorkstationChatOptions {
  activeFolder: string;
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  refetchFiles: () => void;
  reloadOpenTabsContent: () => void;
  onOpenFileTab: (filePath: string, fileName: string, content?: string, silent?: boolean) => Promise<void>;
  upsertCanvasTab: (canvasText: string, isStreamingDone?: boolean) => void;
}

const EDIT_FILE_TOOLS = new Set([
  "write",
  "edit",
  "write_to_file",
  "replace_file_content",
  "apply_patch",
  "edit_document",
  "create_file",
]);

export function useWorkstationChat({
  activeFolder,
  activeChatId,
  setActiveChatId,
  refetchFiles,
  reloadOpenTabsContent,
  onOpenFileTab,
  upsertCanvasTab,
}: UseWorkstationChatOptions) {
  const queryClient = useQueryClient();

  const [reasoningEffort, setReasoningEffort] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const [queuedPrompts, setQueuedPrompts] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const producedFilesRef = useRef<string[]>([]);

  // 1. Fetch chat messages from engine
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

  // 2. Clear optimistic messages only on explicit folder/chat navigation changes
  const prevChatIdRef = useRef(activeChatId);
  const prevFolderRef = useRef(activeFolder);
  useEffect(() => {
    const chatChanged = prevChatIdRef.current !== activeChatId;
    const folderChanged = prevFolderRef.current !== activeFolder;
    prevChatIdRef.current = activeChatId;
    prevFolderRef.current = activeFolder;

    if ((chatChanged || folderChanged) && !isStreaming) {
      setOptimisticMessages([]);
    }
  }, [activeFolder, activeChatId, isStreaming]);

  // 3. Auto-scroll on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
  }, [chatMessages, optimisticMessages, isStreaming]);

  const handleRemoveQueuedPrompt = useCallback((index: number) => {
    setQueuedPrompts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setLiveStatus(null);
    toast.info("Generation stopped");
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveChatId("");
    localStorage.removeItem("arunaki_active_chat_id");
    setOptimisticMessages([]);
    setLiveStatus(null);
    toast.info("New conversation session ready");
  }, [setActiveChatId]);

  const handleSendMessage = async (textToSend: string) => {
    const userText = textToSend ? textToSend.trim() : "";
    if (!userText) return;

    // Queue if currently busy
    if (isStreaming) {
      setQueuedPrompts((prev) => [...prev, userText]);
      toast.info("Message queued and will be processed automatically");
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

    const processNext = () => {
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
    };

    try {
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

          // Auto-open file tab in center panel ONLY if AI is actively editing/writing a document!
          const isEditingTool = EDIT_FILE_TOOLS.has(toolName.toLowerCase());
          const toolData = event.data || {};
          const targetPath =
            toolData.args?.TargetFile ||
            toolData.args?.path ||
            toolData.args?.targetFile ||
            toolData.targetFile ||
            toolData.path;

          if (isEditingTool && targetPath && typeof targetPath === "string") {
            const fileName = targetPath.split(/[/\\]/).pop();
            if (fileName && fileName.includes(".") && fileName !== "." && fileName !== ".." && fileName !== activeFolder) {
              onOpenFileTab(targetPath, fileName, undefined, true);
              if (isDocumentPath(targetPath) && !producedFilesRef.current.includes(targetPath)) {
                producedFilesRef.current.push(targetPath);
              }
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
            upsertCanvasTab(canvasText, false);
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

          // Desktop Notification
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
          } catch {}

          // Auto-backup + auto-open produced documents
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
                } catch {}
              }
            }
          }

          const canvasText = extractCanvasContent(accumulatedResponseText || event.data?.content || "");
          if (canvasText) {
            upsertCanvasTab(canvasText, true);
          }

          queryClient.invalidateQueries({ queryKey: ["chat-messages", chatIdToUse] }).then(() => {
            setOptimisticMessages([]);
          });
          refetchFiles();
          reloadOpenTabsContent();
          processNext();
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
          queryClient.invalidateQueries({ queryKey: ["chat-messages", chatIdToUse] }).then(() => {
            setOptimisticMessages([]);
          });
          processNext();
        }
      }, abortCtrl.signal);

      await sendPrompt(chatIdToUse, userText, { variant: reasoningEffort || undefined });
    } catch (err: any) {
      console.error("[useWorkstationChat] sendPrompt error:", err);
      toast.error(`Error sending message: ${err?.message || err}`);
      setIsStreaming(false);
      setLiveStatus(null);
      processNext();
    }
  };

  return {
    chatMessages,
    optimisticMessages,
    liveStatus,
    isStreaming,
    reasoningEffort,
    setReasoningEffort,
    queuedPrompts,
    messagesEndRef,
    handleSendMessage,
    handleCancelStream,
    handleNewChat,
    handleRemoveQueuedPrompt,
  };
}
