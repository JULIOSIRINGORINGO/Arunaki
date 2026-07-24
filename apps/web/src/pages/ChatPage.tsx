import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatMessages } from "../components/chat/ChatMessages";
import { ChatInput } from "../components/chat/ChatInput";

const API_BASE = "http://localhost:3000/api/v1";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export function ChatPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatId = searchParams.get("chat");

  const createChat = useMutation({
    mutationFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat" }),
        });
        const data = await res.json();
        return data.data.id;
      } catch (e) {
        return `chat-${Date.now()}`;
      }
    },
    onSuccess: (id) => {
      setSearchParams({ chat: id });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const { data: messagesData } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      if (!chatId) return [];
      try {
        const res = await fetch(`${API_BASE}/chat/${chatId}/messages`);
        const data = await res.json();
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!chatId,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let currentChatId = chatId;
      if (!currentChatId) {
        currentChatId = await createChat.mutateAsync();
      }
      try {
        const res = await fetch(`${API_BASE}/chat/${currentChatId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        return res.json();
      } catch (e) {
        return { success: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const messages: Message[] =
    messagesData?.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    })) || [];

  const handleSend = (content: string) => {
    sendMessage.mutate(content);
  };

  return (
    <div className="flex flex-col h-full bg-white min-w-0">
      {/* Header */}
      <div className="shrink-0 px-8 pt-8 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Chat</h1>
      </div>

      {/* Messages area - fills remaining space */}
      <div className="flex-1 overflow-auto min-h-0 px-8">
        <ChatMessages
          messages={messages}
          isLoading={sendMessage.isPending}
          onSelectPrompt={handleSend}
        />
      </div>

      {/* Input composer - sticky at bottom */}
      <div className="shrink-0">
        <ChatInput
          onSend={handleSend}
          disabled={sendMessage.isPending}
        />
      </div>
    </div>
  );
}
