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
  switchSessionModel,
} from "../../../lib/engine";
import { API_BASE, apiFetch } from "../../../lib/api";

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

export function resolveActiveSingleModel(): { providerID: string; id: string } {
  const p = localStorage.getItem("arunaki_active_provider") || "kenari";
  const specific =
    localStorage.getItem("arunaki_active_model") ||
    localStorage.getItem(`arunaki_provider_model_${p}`);
  if (specific && specific.trim() && !specific.includes(",")) {
    return { providerID: p, id: specific.trim() };
  }
  const pool = localStorage.getItem(`arunaki_provider_models_${p}`);
  if (pool && pool.trim()) {
    const list = pool.split(",").map((s) => s.trim()).filter(Boolean);
    const valid =
      list.find(
        (m) =>
          m !== "mistral-large:free" &&
          m !== "glm-4-7-flash:free" &&
          !m.includes("muse-spark") &&
          !m.includes("kimi") &&
          !m.includes("lightning") &&
          !m.includes("tiny") &&
          !m.includes("longcat") &&
          !m.includes("north-mini")
      ) || list[0];
    if (valid) return { providerID: p, id: valid };
  }
  return {
    providerID: p,
    id: p === "kenari" ? "agnes-2-0-flash:free" : "default",
  };
}

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
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const resetWatchdogRef = useRef<((timeoutMs?: number) => void) | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearWatchdog();
  }, [clearWatchdog]);

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

  // 4. Network offline / online resilience listener
  useEffect(() => {
    const handleOffline = () => {
      if (isStreaming) {
        clearWatchdog();
        setLiveStatus({
          type: "thinking",
          preview: "Network disconnected — Waiting for internet connection...",
        });
        toast.warning("Network connection lost", {
          description: "Execution paused. Arunaki will resume automatically when reconnected.",
          duration: 5000,
        });
      }
    };

    const handleOnline = () => {
      if (isStreaming && activeChatId) {
        toast.success("Network connection restored", {
          description: "Resuming session stream...",
          duration: 3000,
        });
        setLiveStatus({
          type: "thinking",
          preview: "Reconnecting to AI stream...",
        });
        // Check if engine already finished processing while offline
        queryClient.invalidateQueries({ queryKey: ["chat-messages", activeChatId] }).then(async () => {
          try {
            const raw = await getMessages(activeChatId);
            const messages = mapEngineMessages(raw || []);
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && lastMsg.content) {
              setIsStreaming(false);
              setLiveStatus(null);
              setOptimisticMessages([]);
              return;
            }
          } catch {}
          // Still waiting for completion: reset watchdog to generous 90s
          resetWatchdogRef.current?.(90000);
        });
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isStreaming, activeChatId, queryClient, clearWatchdog]);

  // 5. Restore Canvas from history on session load so center panel is populated with recent data
  const hasRestoredCanvasRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeChatId || isStreaming || chatMessages.length === 0) return;
    if (hasRestoredCanvasRef.current === activeChatId) return;
    hasRestoredCanvasRef.current = activeChatId;

    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg.role === "assistant" && msg.content) {
        const canvasContent = extractCanvasContent(msg.content);
        if (canvasContent) {
          upsertCanvasTab(canvasContent, false);
          break;
        }
      }
    }
  }, [activeChatId, chatMessages, isStreaming, upsertCanvasTab]);

  const handleRemoveQueuedPrompt = useCallback((index: number) => {
    setQueuedPrompts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCancelStream = useCallback(() => {
    clearWatchdog();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setLiveStatus(null);
    toast.info("Generation stopped");
  }, [clearWatchdog]);

  const handleNewChat = useCallback(async () => {
    clearWatchdog();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setLiveStatus(null);
    setOptimisticMessages([]);
    hasRestoredCanvasRef.current = null;

    // Immediately clear chat to blank state for instant feedback with 0 flicker
    setActiveChatId("");
    queryClient.setQueryData(["chat-messages", ""], []);
    localStorage.removeItem("arunaki_active_chat_id");
    if (activeFolder) {
      localStorage.removeItem(`arunaki_active_chat_id_${activeFolder}`);
    }

    const activeModel = resolveActiveSingleModel();

    try {
      const session = await createSession({
        directory: activeFolder || undefined,
        model: activeModel,
      });
      if (session && session.id) {
        setActiveChatId(session.id);
        localStorage.setItem("arunaki_active_chat_id", session.id);
        if (activeFolder) {
          localStorage.setItem(`arunaki_active_chat_id_${activeFolder}`, session.id);
        }
        queryClient.setQueryData(["chat-messages", session.id], []);
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
    } catch {
      setActiveChatId("");
    }
    toast.info("New conversation session ready");
  }, [activeFolder, setActiveChatId, queryClient]);

  const handleSendMessage = async (textToSend?: string) => {
    const userText = (textToSend !== undefined ? textToSend : "").trim();
    if (!userText || isStreaming) {
      if (textToSend) {
        setQueuedPrompts((prev) => [...prev, userText]);
        toast.info("Message queued and will be processed automatically");
      }
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Computer is offline", {
        description: "Please reconnect to the internet before sending instructions.",
        duration: 5000,
      });
      return;
    }

    const userMessageId = `user-${Date.now()}-${Math.random()}`;
    const assistantMessageId = `asst-${Date.now()}-${Math.random()}`;

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

    const activeModel = resolveActiveSingleModel();

    let chatIdToUse = activeChatId;
    if (!chatIdToUse || !chatIdToUse.startsWith("ses_")) {
      try {
        const session = await createSession({
          directory: activeFolder || undefined,
          model: activeModel,
        });
        chatIdToUse = session.id;
        setActiveChatId(chatIdToUse);
        localStorage.setItem("arunaki_active_chat_id", chatIdToUse);
        if (activeFolder) {
          localStorage.setItem("arunaki_active_folder", activeFolder);
          localStorage.setItem(`arunaki_active_chat_id_${activeFolder}`, chatIdToUse);
        }
      } catch {
        setIsStreaming(false);
        setLiveStatus(null);
        toast.error("Failed to create a new conversation");
        return;
      }
    } else {
      switchSessionModel(chatIdToUse, activeModel).catch(() => {});
    }

    let accumulatedResponseText = "";
    let accumulatedReasoningText = "";
    const streamStartTime = Date.now();
    const accumulatedSteps: StepItem[] = [];

    let hasDispatchedNotification = false;
    const dispatchCompletionNotification = (toolsCount = 0) => {
      if (hasDispatchedNotification) return;
      hasDispatchedNotification = true;
      try {
        const isNotifEnabled = localStorage.getItem("arunaki_pref_desktop_notification") !== "false";
        if (!isNotifEnabled) return;

        const notifBody =
          toolsCount > 0
            ? `Executed ${toolsCount} document task${toolsCount > 1 ? "s" : ""} successfully.`
            : "Document response generated.";

        const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
        if (desktop?.notify) {
          desktop.notify({
            title: "Arunaki Workstation",
            body: notifBody,
          });
        } else if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("Arunaki Workstation", { body: notifBody });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((perm) => {
              if (perm === "granted") {
                new Notification("Arunaki Workstation", { body: notifBody });
              }
            });
          }
        }
      } catch (err) {
        console.warn("[useWorkstationChat] notification error:", err);
      }
    };

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

    const getActiveProviderDiagnostic = async (): Promise<{
      hasConfiguredProvider: boolean;
      activeProviderName: string;
      modelName?: string;
    }> => {
      const activeModel = resolveActiveSingleModel();
      try {
        const res = await apiFetch(`${API_BASE}/providers`);
        if (res.ok) {
          const json = await res.json();
          const providers: any[] = json.data || [];
          if (providers.length === 0) {
            return { hasConfiguredProvider: false, activeProviderName: "" };
          }
          const savedActiveId = localStorage.getItem("arunaki_active_provider");
          const active =
            providers.find((p) => p.id === savedActiveId) ||
            providers.find((p) => p.id === "kenari" || p.apiKey) ||
            providers[0];

          return {
            hasConfiguredProvider: true,
            activeProviderName: active?.name || active?.id || "AI Provider",
            modelName: activeModel.id,
          };
        }
      } catch {}

      const fallbackId = localStorage.getItem("arunaki_active_provider");
      return {
        hasConfiguredProvider: !!fallbackId,
        activeProviderName: fallbackId === "kenari" ? "Kenari" : fallbackId || "AI Provider",
        modelName: activeModel.id,
      };
    };

    const resetWatchdog = (timeoutMs = 90000) => {
      clearWatchdog();
      watchdogRef.current = setTimeout(async () => {
        // If computer is offline, don't abort — wait for reconnect!
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setLiveStatus({
            type: "thinking",
            preview: "Network disconnected — Waiting for internet connection...",
          });
          return;
        }

        abortCtrl.abort();
        setIsStreaming(false);
        setLiveStatus(null);

        const diagnostic = await getActiveProviderDiagnostic();

        if (!diagnostic.hasConfiguredProvider) {
          toast.error("No AI Provider Configured", {
            description: "Please configure an active AI provider in File → Preferences → Settings.",
            duration: 8000,
          });
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: `⚠️ **No Model Provider Configured:**\n\nNo active AI model provider is configured on this workstation.\n\n**Quick Fix:**\n1. Open **File → Preferences → Settings**.\n2. Add and connect your provider (e.g., **Kenari** or **OpenAI**) with a valid API key.\n3. Verify connection with **Test Ping** and ensure it is set to **Primary Active**.\n4. Return here to send your instruction.`,
                  }
                : m
            )
          );
        } else {
          const pName = diagnostic.activeProviderName || "AI Provider";
          toast.error(`Upstream Provider Timeout (${pName})`, {
            description: `The provider did not return a response within 90 seconds (server latency ~5000ms or queue delay).`,
            duration: 7000,
          });
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: `⚠️ **Upstream Provider Timeout (${pName}):**\n\nNo response received from **${pName}** within 90 seconds.\n\n**Diagnostics:**\n- Upstream server latency is high (~5000ms ping) or server queue is currently experiencing heavy load.\n${diagnostic.modelName ? `- Active Model: \`${diagnostic.modelName}\`\n` : ""}\n**Recommendations:**\n1. **Try sending again:** Free model queues often clear within 1-2 minutes.\n2. **Switch model:** In **File → Preferences → Settings**, select another fast model from the model pool.\n3. Verify provider status with **Test Ping** in Settings.`,
                  }
                : m
            )
          );
        }

        processNext();
      }, timeoutMs);
    };

    resetWatchdogRef.current = resetWatchdog;
    resetWatchdog(90000);

    try {
      subscribeEvents((rawEvent) => {
        const event = mapEngineEvent(rawEvent, chatIdToUse);
        if (!event) return;

        if (event.type === "reasoning_delta" && event.data) {
          resetWatchdog(90000);
          accumulatedReasoningText += event.data;
          setLiveStatus({ type: "thinking", preview: "Thinking..." });
          setOptimisticMessages((prev) => {
            const exists = prev.some((m) => m.id === assistantMessageId);
            if (!exists) {
              return [
                ...prev,
                {
                  id: assistantMessageId,
                  role: "assistant",
                  content: "",
                  reasoning: event.data,
                  createdAt: new Date().toISOString(),
                  executionSteps: accumulatedSteps.length > 0 ? [...accumulatedSteps] : undefined,
                },
              ];
            }
            return prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    reasoning: (m.reasoning || "") + event.data,
                    executionSteps: accumulatedSteps.length > 0 ? [...accumulatedSteps] : m.executionSteps,
                  }
                : m
            );
          });
        } else if (event.type === "reasoning_end") {
          resetWatchdog(90000);
          if (event.data && typeof event.data === "string") {
            accumulatedReasoningText = event.data;
          }
          const elapsedSec = Math.max(1, Math.round((Date.now() - streamStartTime) / 1000));
          setLiveStatus({ type: "text_delta", preview: "Generating response" });
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    reasoning: accumulatedReasoningText || m.reasoning,
                    thoughtSec: elapsedSec,
                  }
                : m
            )
          );
        } else if (event.type === "thinking") {
          resetWatchdog(90000);
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
        } else if (event.type === "tool_preparing") {
          resetWatchdog(120000);
          const toolName = event.data?.toolName || "action";
          const label = `Preparing ${toolName}...`;
          setLiveStatus({ type: "tool_preparing", toolName, preview: label });
          if (!accumulatedSteps.some((s) => s.label === label)) {
            accumulatedSteps.push({
              id: `${Date.now()}-${Math.random()}`,
              label,
              status: "running",
              iconType: "tool",
              toolName,
            });
          }
        } else if (event.type === "tool_live_status" || event.type === "tool_start" || event.type === "tool_progress") {
          resetWatchdog(120000);
          const toolName = event.data?.toolName || "desktop_action";
          const preview = event.data?.preview ? ` → ${event.data.preview}` : "";
          const isFinished = event.data?.status === "completed" || event.data?.status === "failed";
          const label = isFinished ? `Executed: ${toolName}${preview}` : `Executing: ${toolName}${preview}`;
          setLiveStatus({
            type: event.type === "tool_live_status" ? "tool_live_status" : "tool_start",
            ...event.data,
            toolName,
            preview: isFinished ? `Completed ${toolName}` : `Executing: ${toolName}${preview}`,
          });

          const prepIdx = accumulatedSteps.findIndex((s) => s.iconType === "tool" && s.label.startsWith(`Preparing ${toolName}`));
          if (prepIdx >= 0) {
            accumulatedSteps[prepIdx] = {
              ...accumulatedSteps[prepIdx],
              label,
              status: isFinished ? "completed" : "running",
              toolName,
            };
          } else if (!accumulatedSteps.some((s) => s.label === label)) {
            accumulatedSteps.push({
              id: `${Date.now()}-${Math.random()}`,
              label,
              status: isFinished ? "completed" : "running",
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
          resetWatchdog(30000);
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
        } else if (event.type === "text_end") {
          if (event.data && typeof event.data === "string") {
            accumulatedResponseText = event.data;
            setOptimisticMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content: event.data,
                    }
                  : m
              )
            );
          }
        } else if (event.type === "done") {
          clearWatchdog();
          setIsStreaming(false);
          setLiveStatus(null);
          const elapsedSec = Math.max(1, Math.round((Date.now() - streamStartTime) / 1000));

          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: accumulatedResponseText || m.content,
                    reasoning: accumulatedReasoningText || m.reasoning,
                    executionSteps: accumulatedSteps.length > 0 ? [...accumulatedSteps] : undefined,
                    thoughtSec: elapsedSec,
                  }
                : m
            )
          );

          // Desktop OS Notification
          const completedToolsCount = event.data?.toolOutputs?.length || accumulatedSteps.filter((s) => s.iconType === "tool").length;
          dispatchCompletionNotification(completedToolsCount);

          // Auto-backup + auto-open produced documents
          const autoOpenOffice =
            localStorage.getItem("arunaki_pref_auto_open_office") === "true" ||
            localStorage.getItem("arunaki_pref_auto_open_excel") === "true";
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

          if (autoOpenOffice && produced.length > 0 && desktop?.openPath) {
            for (const doc of produced) {
              try {
                if ((/\.(xlsx|xls|xlsm|csv)$/i).test(doc) && desktop.openExcelNative) {
                  desktop.openExcelNative(doc);
                } else if ((/\.(docx|doc|rtf)$/i).test(doc) && desktop.openWordNative) {
                  desktop.openWordNative(doc);
                } else {
                  desktop.openPath(doc);
                }
              } catch {}
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
          clearWatchdog();
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
      // Finalize streaming safely
      clearWatchdog();
      setIsStreaming(false);
      setLiveStatus(null);
      dispatchCompletionNotification(accumulatedSteps.filter((s) => s.iconType === "tool").length);
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", chatIdToUse] });
      setOptimisticMessages([]);
      processNext();
    } catch (err: any) {
      clearWatchdog();
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
