import { useState } from "react";
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
  const [chatId, setChatId] = useState<string | null>(null);

  // Create or get chat
  const createChat = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat" }),
      });
      const data = await res.json();
      return data.data.id;
    },
    onSuccess: (id) => {
      setChatId(id);
    },
  });

  // Get messages
  const { data: messagesData } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      if (!chatId) return [];
      const res = await fetch(`${API_BASE}/chat/${chatId}/messages`);
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!chatId,
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let currentChatId = chatId;

      // Create chat if none exists
      if (!currentChatId) {
        currentChatId = await createChat.mutateAsync();
      }

      const res = await fetch(`${API_BASE}/chat/${currentChatId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
  });

  const messages: Message[] = messagesData?.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt,
  })) || [];

  const handleSend = (content: string) => {
    sendMessage.mutate(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Chat with Arunaki
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ask anything or get help with your documents
        </p>
      </header>

      {/* Messages */}
      <ChatMessages
        messages={messages}
        isLoading={sendMessage.isPending}
      />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={sendMessage.isPending} />
    </div>
  );
}
