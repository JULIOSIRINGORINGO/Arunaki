import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { X, MessageSquare, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { LiveExecutionBadge, LiveStatusData } from "./LiveExecutionBadge";
import { LiveMirrorCard } from "./LiveMirrorCard";
import { API_BASE, apiFetch } from "../../lib/api";
import { cn } from "../../lib/utils";

interface PopupChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export const PopupChat: React.FC<PopupChatProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatId = searchParams.get("chat");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const [liveScreenshotUrl, setLiveScreenshotUrl] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setOptimisticMessages([]);
    setLiveStatus(null);
    setLiveScreenshotUrl(null);
    if (!chatId) {
      setPendingChatId(null);
    }
  }, [chatId]);


  const effectiveChatId = chatId || pendingChatId;

  const createChat = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiFetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat" }),
        });
        const data = await res.json();
        if (!data.data?.id) throw new Error("Gagal membuat chat");
        return data.data.id;
      } catch (e) {
        throw e;
      }
    },
    onSuccess: (id) => {
      setPendingChatId(id);
      setSearchParams({ chat: id });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const { data: messagesData = [] } = useQuery({
    queryKey: ["messages", effectiveChatId],
    queryFn: async () => {
      if (!effectiveChatId) return [];
      try {
        const res = await apiFetch(`${API_BASE}/chat/${effectiveChatId}/messages`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!effectiveChatId && isOpen,
  });

  useEffect(() => {
    if (messagesData && messagesData.length > 0) {
      setOptimisticMessages([]);
    }
  }, [messagesData]);


  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let activeId = effectiveChatId;
      if (!activeId) {
        activeId = await createChat.mutateAsync();
      }

      const tempUserMsgId = `temp-user-${Date.now()}`;
      const tempAssistantMsgId = `temp-assistant-${Date.now()}`;

      const userMsg: Message = {
        id: tempUserMsgId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      setOptimisticMessages((prev) => [...prev, userMsg]);

      try {
        let fullStreamedContent = "";

        await fetchEventSource(`${API_BASE}/chat/${activeId}/stream`, {
          fetch: apiFetch,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          onmessage(msg) {
            if (!msg.data) return;
            try {
              const event = JSON.parse(msg.data);
              if (event.type === "tool_live_status" && event.data) {
                setLiveStatus({
                  toolName: event.data.toolName,
                  preview: event.data.preview,
                  screenshot: event.data.screenshot,
                  timestamp: event.data.timestamp,
                });
                if (event.data.screenshot) {
                  setLiveScreenshotUrl(event.data.screenshot);
                }
              } else if (event.type === "text_delta" && typeof event.data === "string") {
                fullStreamedContent += event.data;
                setOptimisticMessages((prev) => {
                  const filtered = prev.filter((m) => m.id !== tempAssistantMsgId);
                  return [
                    ...filtered,
                    {
                      id: tempAssistantMsgId,
                      role: "assistant",
                      content: fullStreamedContent,
                      createdAt: new Date().toISOString(),
                    },
                  ];
                });
              }
            } catch {
              // ignore parse errors
            }
          },
          onerror(err) {
            console.error("Popup chat SSE error:", err);
            throw err;
          },
        });

        await queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      } catch (e) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId && m.id !== tempAssistantMsgId));
        throw e;
      }
    },
  });

  const serverMessages: Message[] =
    messagesData?.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    })) || [];

  const serverContentSet = new Set(serverMessages.map((m) => m.content));
  const filteredOptimistic = optimisticMessages.filter(
    (m) => m.id.startsWith("temp-") && !serverContentSet.has(m.content)
  );
  const messages = [...serverMessages, ...filteredOptimistic];

  const handleSend = (content: string) => {
    if (sendMessage.isPending) return;
    sendMessage.mutate(content, {
      onError: (err) => {
        toast.error(err.message || "Gagal mengirim pesan.");
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300 flex flex-col bg-white rounded-[24px] shadow-2xl border border-stone-800/20 overflow-hidden",
        isExpanded
          ? "top-6 bottom-6 left-6 right-6"
          : "top-20 right-8 w-[480px] h-[calc(100vh-110px)] max-w-[calc(100vw-48px)] max-h-[640px]"
      )}

    >
      {/* Header Bar of Popup Chat */}
      <div className="bg-[#1A191B] px-5 py-3.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#C4B5FD] flex items-center justify-center text-[#1A191B]">
            <MessageSquare size={14} className="fill-current" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide">
              Arunaki AI Chat
            </h3>
            <p className="text-[10px] text-stone-400 font-medium">
              Popup Chat &bull; Terhubung
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <LiveExecutionBadge status={liveStatus} active={sendMessage.isPending} />
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            title={isExpanded ? "Kecilkan" : "Perbesar"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            title="Sembunyikan ke :chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Body of Popup Chat */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 bg-white">
        <ChatMessages
          messages={messages}
          isLoading={sendMessage.isPending}
          onSelectPrompt={handleSend}
          onActionChipClick={handleSend}
        />
        {liveScreenshotUrl && (
          <LiveMirrorCard screenshotUrl={liveScreenshotUrl} />
        )}
      </div>

      {/* Input Footer */}
      <div className="border-t border-stone-100 bg-stone-50/50 p-3">
        <ChatInput
          onSend={handleSend}
          disabled={sendMessage.isPending}
        />
      </div>
    </div>
  );
};
